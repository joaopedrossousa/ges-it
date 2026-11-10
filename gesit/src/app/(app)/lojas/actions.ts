"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  erroDoBanco,
  errosDoZod,
  type ActionResult,
} from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { lojaSchema, type LojaFormInput } from "@/lib/validators";

type CampoLoja = keyof LojaFormInput;

const DUPLICIDADES = [
  { coluna: "nome", campo: "nome" as const, mensagem: "Já existe uma loja com este nome." },
];

function revalidar() {
  revalidatePath("/lojas");
  // Nomes de loja aparecem na listagem e nos formulários de usuários.
  revalidatePath("/colaboradores", "layout");
}

export async function criarLoja(
  input: LojaFormInput,
): Promise<ActionResult<CampoLoja>> {
  const parsed = lojaSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("lojas").insert(parsed.data);
  if (error) return erroDoBanco(error, DUPLICIDADES);

  revalidar();
  return { ok: true };
}

export async function atualizarLoja(
  id: string,
  input: LojaFormInput,
): Promise<ActionResult<CampoLoja>> {
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, error: "Loja inválida." };
  }
  const parsed = lojaSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lojas")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return erroDoBanco(error, DUPLICIDADES);
  if (!data?.length) return { ok: false, error: "Loja não encontrada." };

  revalidar();
  return { ok: true };
}
