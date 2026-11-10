"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  erroDoBanco,
  errosDoZod,
  type ActionResult,
} from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { TipoDispositivo } from "@/lib/types";
import {
  colaboradorSchema,
  formatarIMEI,
  type ColaboradorFormInput,
} from "@/lib/validators";

type CampoColaborador = keyof ColaboradorFormInput;

const DUPLICIDADES = [
  { coluna: "cpf", campo: "cpf" as const, mensagem: "CPF já cadastrado." },
  { coluna: "email", campo: "email" as const, mensagem: "E-mail já cadastrado." },
];

const idSchema = z.uuid();

function revalidar(id?: string) {
  revalidatePath("/colaboradores");
  if (id) revalidatePath(`/colaboradores/${id}`);
}

export async function criarColaborador(
  input: ColaboradorFormInput,
): Promise<ActionResult<CampoColaborador>> {
  const parsed = colaboradorSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("colaboradores")
    .insert({ ...parsed.data, ativo: true });
  if (error) return erroDoBanco(error, DUPLICIDADES);

  revalidar();
  return { ok: true };
}

export async function atualizarColaborador(
  id: string,
  input: ColaboradorFormInput,
): Promise<ActionResult<CampoColaborador>> {
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: "Usuário inválido." };
  }
  const parsed = colaboradorSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  // `ativo` só muda por alterarStatusColaborador; o default do schema
  // (true) não pode reativar um usuário inativo ao editar.
  const { ativo: _ignorado, ...dados } = parsed.data;
  void _ignorado;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .update(dados)
    .eq("id", id)
    .select("id");
  if (error) return erroDoBanco(error, DUPLICIDADES);
  if (!data?.length) return { ok: false, error: "Usuário não encontrado." };

  revalidar(id);
  return { ok: true };
}

export type DispositivoPendente = {
  id: string;
  tipo: TipoDispositivo;
  marca: string;
  modelo: string;
  /** Ex.: "IMEI 35-209900-176148-1" ou "Serial ABC123". */
  identificacao: string;
};

export type ResultadoStatusColaborador =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** Presente quando a inativação foi barrada por vínculos abertos. */
      dispositivosPendentes?: DispositivoPendente[];
    };

const MSG_VINCULOS_ABERTOS =
  "Devolva ou transfira os dispositivos antes de inativar.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Dispositivos com vínculo aberto (data_fim nula) para o colaborador. */
async function dispositivosEmAberto(
  supabase: Supabase,
  colaboradorId: string,
): Promise<{ lista: DispositivoPendente[]; erro: ActionResult | null }> {
  const { data, error } = await supabase
    .from("vinculos")
    .select("dispositivo:dispositivos(id, tipo, marca, modelo, serial_number, imei1)")
    .eq("colaborador_id", colaboradorId)
    .is("data_fim", null);

  if (error) return { lista: [], erro: erroDoBanco(error) };

  const lista = data.flatMap(({ dispositivo: d }) => {
    if (!d) return [];
    const identificacao =
      d.tipo === "telefone" && d.imei1
        ? `IMEI ${formatarIMEI(d.imei1)}`
        : d.serial_number
          ? `Serial ${d.serial_number}`
          : "Sem identificador";
    return [{ id: d.id, tipo: d.tipo, marca: d.marca, modelo: d.modelo, identificacao }];
  });
  return { lista, erro: null };
}

export async function alterarStatusColaborador(
  id: string,
  ativo: boolean,
): Promise<ResultadoStatusColaborador> {
  if (!idSchema.safeParse(id).success || typeof ativo !== "boolean") {
    return { ok: false, error: "Dados inválidos." };
  }

  const supabase = await createClient();

  // Regra: não inativar quem ainda está com dispositivos.
  if (!ativo) {
    const { lista, erro } = await dispositivosEmAberto(supabase, id);
    if (erro) return erro;
    if (lista.length > 0) {
      return { ok: false, error: MSG_VINCULOS_ABERTOS, dispositivosPendentes: lista };
    }
  }

  const { data, error } = await supabase
    .from("colaboradores")
    .update({ ativo })
    .eq("id", id)
    .select("id");

  if (error) {
    // A trigger trg_colaboradores_bloqueia_inativacao (migration 002) barra
    // a inativação se um vínculo surgiu entre a checagem acima e o update.
    if (error.code === "P0001" && error.message.startsWith("Devolva ou transfira")) {
      const { lista } = await dispositivosEmAberto(supabase, id);
      revalidar(id);
      return { ok: false, error: MSG_VINCULOS_ABERTOS, dispositivosPendentes: lista };
    }
    return erroDoBanco(error);
  }
  if (!data?.length) return { ok: false, error: "Usuário não encontrado." };

  revalidar(id);
  return { ok: true };
}
