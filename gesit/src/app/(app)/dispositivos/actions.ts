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
  STATUS_DISPOSITIVO_LABEL,
  STATUS_EDITAVEIS,
  ehStatusDispositivo,
} from "@/lib/types";
import {
  devolucaoSchema,
  dispositivoSchema,
  vinculoSchema,
  type DevolucaoFormInput,
  type DispositivoFormData,
  type DispositivoFormInput,
  type VinculoFormInput,
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
const statusSchema = z.enum(STATUS_EDITAVEIS, { error: "Status inválido." });

type Supabase = Awaited<ReturnType<typeof createClient>>;

function revalidar() {
  revalidatePath("/"); // Dashboard
  revalidatePath("/dispositivos");
  revalidatePath("/dispositivos/[id]", "page");
}

/** Vínculos também aparecem no detalhe dos usuários envolvidos. */
function revalidarVinculos() {
  revalidar();
  revalidatePath("/colaboradores/[id]", "page");
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
  // `unknown`: Server Actions recebem dados vindos da rede; o zod valida.
  status: unknown,
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

// ===========================================================================
// Vínculos
// ===========================================================================

type CampoVinculo = "colaborador_id" | "termo_path" | "observacao";

/** Troca "(status: manutencao)" das mensagens do SQL pelo rótulo em português. */
function mensagemStatus(texto: string) {
  return texto.replace(/\(status: (\w+)\)/, (_, s: string) =>
    ehStatusDispositivo(s) ? `(${STATUS_DISPOSITIVO_LABEL[s].toLowerCase()})` : `(${s})`,
  );
}

/**
 * Vincula o dispositivo a um usuário. Se já houver vínculo aberto, a função
 * SQL vincular_dispositivo encerra o anterior (transferência).
 * O PDF do termo já foi enviado pelo navegador para o bucket "termos".
 */
export async function vincularDispositivo(
  input: VinculoFormInput,
): Promise<ActionResult<CampoVinculo>> {
  const parsed = vinculoSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);
  const { dispositivo_id, colaborador_id, termo_path, observacao } = parsed.data;

  // Só aceita {dispositivo_id}/{timestamp}_{colaborador_id}.pdf deste vínculo.
  if (
    termo_path &&
    !new RegExp(`^${dispositivo_id}/\\d+_${colaborador_id}\\.pdf$`).test(termo_path)
  ) {
    return {
      ok: false,
      error: "Arquivo do termo inválido.",
      fieldErrors: { termo_path: "Arquivo do termo inválido." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("vincular_dispositivo", {
    p_dispositivo_id: dispositivo_id,
    p_colaborador_id: colaborador_id,
    p_termo_path: termo_path ?? undefined,
    p_observacao: observacao ?? undefined,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Este dispositivo acabou de receber outro vínculo. Atualize a página.",
      };
    }
    const resultado = erroDoBanco<CampoVinculo>(error);
    return resultado.ok
      ? resultado
      : { ...resultado, error: mensagemStatus(resultado.error) };
  }

  revalidarVinculos();
  return { ok: true };
}

/** Encerra o vínculo aberto e define o novo status do dispositivo. */
export async function devolverDispositivo(
  input: DevolucaoFormInput,
): Promise<ActionResult<"observacao" | "novo_status">> {
  const parsed = devolucaoSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);
  const { dispositivo_id, observacao, novo_status } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("devolver_dispositivo", {
    p_dispositivo_id: dispositivo_id,
    p_observacao: observacao ?? undefined,
    p_novo_status: novo_status,
  });
  if (error) return erroDoBanco(error);

  revalidarVinculos();
  return { ok: true };
}

/**
 * Anexa o termo a um vínculo sem termo. A função SQL anexar_termo trava o
 * vínculo, recusa se já houver termo, confere a pasta do dispositivo e se o
 * arquivo existe no bucket.
 */
export async function anexarTermo(
  vinculoId: string,
  termoPath: string,
): Promise<ActionResult> {
  if (
    !idSchema.safeParse(vinculoId).success ||
    typeof termoPath !== "string" ||
    // {dispositivo_id}/{timestamp}_{colaborador_id}.pdf — a pasta do
    // dispositivo é conferida de novo na função SQL anexar_termo.
    !/^[0-9a-f-]{36}\/\d+_[0-9a-f-]{36}\.pdf$/.test(termoPath)
  ) {
    return { ok: false, error: "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("anexar_termo", {
    p_vinculo_id: vinculoId,
    p_termo_path: termoPath,
  });
  if (error) return erroDoBanco(error);

  revalidarVinculos();
  return { ok: true };
}
