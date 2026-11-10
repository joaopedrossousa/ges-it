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
  colaboradorSchema,
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

export async function alterarStatusColaborador(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success || typeof ativo !== "boolean") {
    return { ok: false, error: "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .update({ ativo })
    .eq("id", id)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { ok: false, error: "Usuário não encontrado." };

  revalidar(id);
  return { ok: true };
}
