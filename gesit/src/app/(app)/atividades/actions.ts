"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { erroDoBanco as erroDoBancoBruto, errosDoZod, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  atividadeSchema,
  categoriaKanbanSchema,
  colunaKanbanSchema,
  comentarioSchema,
  edicaoComentarioSchema,
  type AtividadeFormInput,
  type CategoriaKanbanFormInput,
  type ColunaKanbanFormInput,
  type ComentarioInput,
  type EdicaoComentarioInput,
} from "@/lib/validators";

/**
 * Colunas, atividades e as categorias das atividades só são gravadas pelas
 * funções da migration 017 (posições reindexadas no banco, sob trava).
 * Categorias vão direto na tabela (grant por coluna).
 */

const idSchema = z.uuid();
const posicaoSchema = z.number().int().min(0).max(100_000);

/**
 * As funções SQL (017 e 022) ainda dizem "arquivada" para a atividade; na
 * interface ela é "concluída" (migration 028). Colunas continuam arquivadas.
 */
function erroDoBanco<Campo extends string>(
  ...args: Parameters<typeof erroDoBancoBruto<Campo>>
): ActionResult<Campo> {
  const r = erroDoBancoBruto<Campo>(...args);
  if (r.ok) return r;
  return {
    ...r,
    error: r.error
      .replace("Esta atividade está arquivada. Restaure-a", "Esta atividade está concluída. Reabra-a")
      .replace("Mova ou arquive as atividades", "Mova ou conclua as atividades")
      .replace("Restaure a atividade em outra coluna", "Reabra a atividade em outra coluna"),
  };
}

/** Quadro, concluídas e categorias leem as mesmas tabelas. */
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

/** Devolve o id: o painel marca "Urgente" logo depois, se pedido. */
export async function criarAtividade(
  input: AtividadeFormInput,
): Promise<ActionResult<CampoAtividade> & { id?: string }> {
  const parsed = atividadeSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("criar_atividade", {
    p_coluna: d.coluna_id,
    p_titulo: d.titulo,
    p_prioridade: d.prioridade,
    p_responsavel: d.responsavel_id ?? undefined,
    p_prazo: d.prazo ?? undefined,
    p_categorias: d.categorias,
  });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true, id };
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

/** Concluir (no banco: arquivar_atividade, que grava concluida_em/por). */
export async function arquivarAtividade(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return invalido("Atividade");

  const supabase = await createClient();
  const { error } = await supabase.rpc("arquivar_atividade", { p_atividade: id });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

/** Reabrir: volta para o fim da coluna escolhida (sem coluna: a de antes). */
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

/** Liga ou desliga a flag "Urgente" (o banco grava quem marcou e quando). */
export async function marcarUrgente(id: string, urgente: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return invalido("Atividade");
  if (typeof urgente !== "boolean") return { ok: false, error: "Valor inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_urgente", { p_atividade: id, p_urgente: urgente });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

// ===========================================================================
// Comentários (migration 022). As imagens já foram enviadas pelo navegador
// ao bucket "atividades"; as funções conferem a pasta e o arquivo.
// ===========================================================================

type CampoComentario = "texto" | "anexos";

export async function adicionarComentario(
  input: ComentarioInput,
): Promise<ActionResult<CampoComentario>> {
  const parsed = comentarioSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);
  const { atividade_id, texto, anexos } = parsed.data;
  if (!texto && anexos.length === 0) {
    return { ok: false, error: "Escreva um comentário ou anexe uma imagem." };
  }
  if (anexos.some((a) => !a.path.startsWith(`${atividade_id}/`))) return invalido("Imagem");

  const supabase = await createClient();
  const { error } = await supabase.rpc("adicionar_comentario", {
    p_atividade: atividade_id,
    p_texto: texto ?? "", // vazio = sem texto (a função usa nullif)
    p_anexos: anexos,
  });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

/** Só o autor (conferido no banco). */
export async function editarComentario(
  input: EdicaoComentarioInput,
): Promise<ActionResult<CampoComentario>> {
  const parsed = edicaoComentarioSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("editar_comentario", {
    p_comentario: d.comentario_id,
    p_texto: d.texto ?? "",
    p_anexos_novos: d.anexos_novos,
    p_anexos_removidos: d.anexos_removidos,
  });
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

/** Só o autor (conferido no banco). Marca como removido. */
export async function removerComentario(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return invalido("Comentário");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remover_comentario", { p_comentario: id });
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
