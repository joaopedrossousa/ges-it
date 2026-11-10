"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  erroDoBanco,
  errosDoZod,
  type ActionResult,
} from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  dispositivoSchema,
  type DispositivoFormData,
  type DispositivoFormInput,
} from "@/lib/validators";

type CampoDispositivo = "marca" | "modelo" | "serial_number" | "imei1" | "imei2";

const DUPLICIDADES = [
  {
    coluna: "serial_number",
    campo: "serial_number" as const,
    mensagem: "Serial Number já cadastrado em outro dispositivo.",
  },
  {
    coluna: "imei1",
    campo: "imei1" as const,
    mensagem: "IMEI 1 já cadastrado em outro dispositivo.",
  },
  {
    coluna: "imei2",
    campo: "imei2" as const,
    mensagem: "IMEI 2 já cadastrado em outro dispositivo.",
  },
];

const idSchema = z.uuid();
const statusSchema = z.enum(["disponivel", "manutencao", "baixado"], {
  error: "Status inválido.",
});

type Supabase = Awaited<ReturnType<typeof createClient>>;

function revalidar() {
  revalidatePath("/dispositivos");
}

/** Campos gravados no banco. `status` e `tipo` nunca mudam pela edição. */
function camposEditaveis(d: DispositivoFormData) {
  if (d.tipo === "notebook") {
    return {
      marca: d.marca,
      modelo: d.modelo,
      serial_number: d.serial_number,
      observacao: d.observacao,
    };
  }
  return {
    marca: d.marca,
    modelo: d.modelo,
    serial_number: d.serial_number,
    imei1: d.imei1,
    imei2: d.imei2,
    observacao: d.observacao,
  };
}

/**
 * O banco só garante unicidade por coluna (imei1 com imei1, imei2 com imei2).
 * Aqui também barramos o IMEI 1 de um aparelho igual ao IMEI 2 de outro.
 */
async function conferirImeis(
  supabase: Supabase,
  d: DispositivoFormData,
  ignorarId?: string,
): Promise<ActionResult<CampoDispositivo> | null> {
  if (d.tipo !== "telefone") return null;

  const imeis = [d.imei1, d.imei2].filter((i): i is string => Boolean(i));
  // Só dígitos (validados pelo schema), seguros dentro do filtro.
  const lista = imeis.join(",");
  let query = supabase
    .from("dispositivos")
    .select("id, marca, modelo, imei1, imei2")
    .or(`imei1.in.(${lista}),imei2.in.(${lista})`)
    .limit(1);
  if (ignorarId) query = query.neq("id", ignorarId);

  const { data, error } = await query;
  if (error) return erroDoBanco(error);

  const outro = data[0];
  if (!outro) return null;

  const campo: CampoDispositivo =
    outro.imei1 === d.imei1 || outro.imei2 === d.imei1 ? "imei1" : "imei2";
  const mensagem = `IMEI já cadastrado em outro dispositivo (${outro.marca} ${outro.modelo}).`;
  return { ok: false, error: mensagem, fieldErrors: { [campo]: mensagem } };
}

export async function criarDispositivo(
  input: DispositivoFormInput,
): Promise<ActionResult<CampoDispositivo>> {
  const parsed = dispositivoSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const conflito = await conferirImeis(supabase, parsed.data);
  if (conflito) return conflito;

  const { error } = await supabase.from("dispositivos").insert({
    tipo: parsed.data.tipo,
    status: "disponivel",
    ...camposEditaveis(parsed.data),
  });
  if (error) return erroDoBanco(error, DUPLICIDADES);

  revalidar();
  return { ok: true };
}

export async function atualizarDispositivo(
  id: string,
  input: DispositivoFormInput,
): Promise<ActionResult<CampoDispositivo>> {
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: "Dispositivo inválido." };
  }
  const parsed = dispositivoSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const conflito = await conferirImeis(supabase, parsed.data, id);
  if (conflito) return conflito;

  const { data, error } = await supabase
    .from("dispositivos")
    .update(camposEditaveis(parsed.data))
    .eq("id", id)
    .eq("tipo", parsed.data.tipo) // o tipo não pode ser trocado
    .select("id");
  if (error) return erroDoBanco(error, DUPLICIDADES);
  if (!data?.length) return { ok: false, error: "Dispositivo não encontrado." };

  revalidar();
  return { ok: true };
}

/**
 * Muda o status para disponível, manutenção ou baixado.
 * Bloqueado enquanto houver vínculo aberto: "em uso" só sai pela devolução.
 */
export async function alterarStatusDispositivo(
  id: string,
  status: string,
): Promise<ActionResult> {
  const parsedStatus = statusSchema.safeParse(status);
  if (!idSchema.safeParse(id).success || !parsedStatus.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: atual, error: erroLeitura } = await supabase
    .from("vw_dispositivos")
    .select("vinculo_id, colaborador_nome")
    .eq("id", id)
    .maybeSingle();
  if (erroLeitura) return erroDoBanco(erroLeitura);
  if (!atual) return { ok: false, error: "Dispositivo não encontrado." };
  if (atual.vinculo_id) {
    return {
      ok: false,
      error: `Dispositivo vinculado a ${atual.colaborador_nome ?? "um usuário"}. Faça a devolução antes de alterar o status.`,
    };
  }

  // A condição status <> em_uso protege contra um vínculo criado entre a
  // leitura acima e este update (vincular_dispositivo grava em_uso).
  const { data, error } = await supabase
    .from("dispositivos")
    .update({ status: parsedStatus.data })
    .eq("id", id)
    .neq("status", "em_uso")
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) {
    return {
      ok: false,
      error: "O dispositivo acabou de ser vinculado. Atualize a página e faça a devolução antes.",
    };
  }

  revalidar();
  return { ok: true };
}
