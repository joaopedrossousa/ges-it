import { cache } from "react";

import type { AtividadeQuadro, CategoriaKanban, ColunaQuadro, UsuarioSistema } from "@/lib/atividades";
import { buscarTodas } from "@/lib/relatorios/comum";
import { createClient } from "@/lib/supabase/server";

/** A descrição (legado da 017) não é mais lida: virou o primeiro comentário (022). */
export const SELECT_ATIVIDADE =
  "id, coluna_id, titulo, prioridade, responsavel_id, prazo, criado_por, created_at, updated_at, urgente, urgente_por, urgente_em, kanban_atividade_categorias(categoria_id)";

type AtividadeBruta = Omit<AtividadeQuadro, "categorias" | "comentarios"> & {
  kanban_atividade_categorias: { categoria_id: string }[];
};

export function paraAtividadeQuadro(
  { kanban_atividade_categorias, ...a }: AtividadeBruta,
  comentarios = 0,
): AtividadeQuadro {
  return {
    ...a,
    categorias: kanban_atividade_categorias.map((c) => c.categoria_id),
    comentarios,
  };
}

/** Usuários do sistema (responsáveis), por e-mail. Uma consulta por requisição. */
export const listarUsuariosSistema = cache(async (): Promise<UsuarioSistema[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("usuarios_sistema");
  if (error) throw new Error(error.message);
  return data.map((u) => ({ id: u.id, email: u.email, nome: u.nome || null }));
});

/** Todas as categorias (ativas e inativas), por nome. */
export const listarCategoriasKanban = cache(async (): Promise<CategoriaKanban[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kanban_categorias")
    .select("id, nome, cor, ativa")
    .order("nome")
    .order("id");
  if (error) throw new Error(error.message);
  return data;
});

/** Colunas ativas na ordem do quadro. */
export const listarColunasAtivas = cache(async (): Promise<ColunaQuadro[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kanban_colunas")
    .select("id, nome, cor")
    .eq("arquivada", false)
    .order("posicao")
    .order("id");
  if (error) throw new Error(error.message);
  return data;
});

/**
 * Atividades ativas, na ordem de cada coluna, com o número de comentários
 * (em lotes: o PostgREST devolve até 1.000 linhas por resposta).
 */
export async function listarAtividadesAtivas(): Promise<AtividadeQuadro[]> {
  const supabase = await createClient();
  const [linhas, contagens] = await Promise.all([
    buscarTodas((de, ate) =>
      supabase
        .from("kanban_atividades")
        .select(SELECT_ATIVIDADE)
        .eq("arquivada", false)
        .order("coluna_id")
        .order("posicao")
        .order("id")
        .range(de, ate),
    ),
    buscarTodas((de, ate) =>
      supabase
        .from("vw_kanban_comentarios_contagem")
        .select("atividade_id, total")
        .order("atividade_id")
        .range(de, ate),
    ),
  ]);
  const comentarios = new Map(contagens.map((c) => [c.atividade_id, c.total ?? 0]));
  return linhas.map((l) => paraAtividadeQuadro(l, comentarios.get(l.id) ?? 0));
}
