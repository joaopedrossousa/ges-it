"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { erroDoBanco, errosDoZod, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { nomeExibicaoSchema, type NomeExibicaoInput } from "@/lib/validators";

/**
 * Grava o nome de exibição de um usuário do sistema pela função
 * definir_nome_usuario (migration 027; a auditoria registra quem alterou,
 * o nome antigo e o novo). Sem perfis de acesso por enquanto: qualquer
 * usuário logado pode editar.
 */
export async function definirNomeUsuario(
  usuarioId: string,
  input: NomeExibicaoInput,
): Promise<ActionResult<"nome">> {
  if (!z.uuid().safeParse(usuarioId).success) return { ok: false, error: "Usuário inválido." };
  const parsed = nomeExibicaoSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("definir_nome_usuario", {
    p_usuario: usuarioId,
    p_nome: parsed.data.nome,
  });
  if (error) return erroDoBanco(error);

  // O nome aparece em todo o app (Kanban, Início, auditoria, financeiro...).
  revalidatePath("/", "layout");
  return { ok: true };
}
