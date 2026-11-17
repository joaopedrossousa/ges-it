"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { erroDoBanco, errosDoZod, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  atividadeSchema,
  categoriaKanbanSchema,
  colunaKanbanSchema,
  type AtividadeFormInput,
  type CategoriaKanbanFormInput,
  type ColunaKanbanFormInput,
} from "@/lib/validators";

/**
 * Colunas, atividades e as categorias das atividades só são gravadas pelas
 * funções da migration 017 (posições reindexadas no banco, sob trava).
 * Categorias vão direto na tabela (grant por coluna).
 */

const idSchema = z.uuid();
const posicaoSchema = z.number().int().min(0).max(100_000);

/** Quadro, arquivadas e categorias leem as mesmas tabelas. */
function revalidar() {
  revalidatePath("/atividades", "layout");
}

const invalido = (o: string): { ok: false; error: string } => ({ ok: false, error: `${o} inválida.` });

// ===========================================================================
// Colunas
// ===========================================================================

type CampoColuna = keyof ColunaKanbanFormInput;

export async function criarColuna(input: ColunaKanbanFormInput): Promise<ActionResult<CampoColuna>> {
  const parsed = colunaKanbanSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("criar_coluna", {
    p_nome: parsed.data.nome,
    p_cor: parsed.data.cor,
  });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

export async function atualizarColuna(
  id: string,
  input: ColunaKanbanFormInput,
): Promise<ActionResult<CampoColuna>> {
  if (!idSchema.safeParse(id).success) return invalido("Coluna");
  const parsed = colunaKanbanSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("atualizar_coluna", {
    p_coluna: id,
    p_nome: parsed.data.nome,
    p_cor: parsed.data.cor,
  });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

/** Leva a coluna para a posição (0 = primeira); o banco reindexa as demais. */
export async function moverColuna(id: string, posicao: number): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return invalido("Coluna");
  if (!posicaoSchema.safeParse(posicao).success) return invalido("Posição");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mover_coluna", { p_coluna: id, p_posicao: posicao });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

/** Recusada pelo banco se a coluna tiver atividades ativas. */
export async function arquivarColuna(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return invalido("Coluna");

  const supabase = await createClient();
  const { error } = await supabase.rpc("arquivar_coluna", { p_coluna: id });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

export async function restaurarColuna(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return invalido("Coluna");

  const supabase = await createClient();
  const { error } = await supabase.rpc("restaurar_coluna", { p_coluna: id });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

// ===========================================================================
// Atividades
// ===========================================================================

type CampoAtividade = keyof AtividadeFormInput;

export async function criarAtividade(
  input: AtividadeFormInput,
): Promise<ActionResult<CampoAtividade>> {
  const parsed = atividadeSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("criar_atividade", {
    p_coluna: d.coluna_id,
    p_titulo: d.titulo,
    p_prioridade: d.prioridade,
    p_descricao: d.descricao ?? undefined,
    p_responsavel: d.responsavel_id ?? undefined,
    p_prazo: d.prazo ?? undefined,
    p_categorias: d.categorias,
  });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

/** Trocar a coluna aqui leva a atividade para o fim da nova coluna. */
export async function atualizarAtividade(
  id: string,
  input: AtividadeFormInput,
): Promise<ActionResult<CampoAtividade>> {
  if (!idSchema.safeParse(id).success) return invalido("Atividade");
  const parsed = atividadeSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("atualizar_atividade", {
    p_atividade: id,
    p_coluna: d.coluna_id,
    p_titulo: d.titulo,
    p_prioridade: d.prioridade,
    p_descricao: d.descricao ?? undefined,
    p_responsavel: d.responsavel_id ?? undefined,
    p_prazo: d.prazo ?? undefined,
    p_categorias: d.categorias,
  });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

/** Arrastar e soltar: coluna de destino e posição final (0 = topo). */
export async function moverAtividade(
  id: string,
  colunaId: string,
  posicao: number,
): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return invalido("Atividade");
  if (!idSchema.safeParse(colunaId).success) return invalido("Coluna");
  if (!posicaoSchema.safeParse(posicao).success) return invalido("Posição");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mover_atividade", {
    p_atividade: id,
    p_coluna_destino: colunaId,
    p_posicao: posicao,
  });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

export async function arquivarAtividade(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return invalido("Atividade");

  const supabase = await createClient();
  const { error } = await supabase.rpc("arquivar_atividade", { p_atividade: id });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

/** Volta para o fim da coluna escolhida (sem coluna: a de antes). */
export async function restaurarAtividade(id: string, colunaId?: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return invalido("Atividade");
  if (colunaId !== undefined && !idSchema.safeParse(colunaId).success) return invalido("Coluna");

  const supabase = await createClient();
  const { error } = await supabase.rpc("restaurar_atividade", {
    p_atividade: id,
    p_coluna: colunaId,
  });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

// ===========================================================================
// Categorias
// ===========================================================================

type CampoCategoria = keyof CategoriaKanbanFormInput;

const DUPLICIDADE_CATEGORIA = [
  { coluna: "nome", campo: "nome" as const, mensagem: "Já existe uma categoria com esse nome." },
];

export async function criarCategoria(
  input: CategoriaKanbanFormInput,
): Promise<ActionResult<CampoCategoria>> {
  const parsed = categoriaKanbanSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("kanban_categorias")
    .insert({ nome: parsed.data.nome, cor: parsed.data.cor });
  if (error) return erroDoBanco(error, DUPLICIDADE_CATEGORIA);

  revalidar();
  return { ok: true };
}

export async function atualizarCategoria(
  id: string,
  input: CategoriaKanbanFormInput,
): Promise<ActionResult<CampoCategoria>> {
  if (!idSchema.safeParse(id).success) return invalido("Categoria");
  const parsed = categoriaKanbanSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kanban_categorias")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return erroDoBanco(error, DUPLICIDADE_CATEGORIA);
  if (!data?.length) return { ok: false, error: "Categoria não encontrada." };

  revalidar();
  return { ok: true };
}
