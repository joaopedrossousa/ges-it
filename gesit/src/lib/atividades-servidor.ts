import { cache } from "react";

import {
  SEM_RESPONSAVEL,
  type AtividadeQuadro,
  type CategoriaKanban,
  type ColunaQuadro,
  type UsuarioSistema,
} from "@/lib/atividades";
import { palavrasBusca } from "@/lib/busca";
import { intervaloDoMes, type FiltrosConcluidas } from "@/lib/filtros-concluidas";
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

/** Campos da tela Concluídas (os do quadro mais a conclusão, migration 028). */
const SELECT_CONCLUIDA =
  "id, coluna_id, titulo, prioridade, responsavel_id, prazo, criado_por, created_at, updated_at, urgente, urgente_por, urgente_em, concluida_em, concluida_por, kanban_atividade_categorias(categoria_id)";

export type AtividadeConcluida = AtividadeQuadro & {
  concluida_em: string | null;
  concluida_por: string | null;
};

/**
 * Concluídas (arquivada no banco) com os filtros da tela, da conclusão mais
 * recente para a mais antiga. Mês no fuso de Palmas.
 */
export async function listarAtividadesConcluidas(f: FiltrosConcluidas): Promise<AtividadeConcluida[]> {
  const supabase = await createClient();
  const linhas = await buscarTodas((de, ate) => {
    let q = supabase.from("kanban_atividades").select(SELECT_CONCLUIDA).eq("arquivada", true);
    if (f.mes) {
      const { desde, antesDe } = intervaloDoMes(f.mes);
      q = q.gte("concluida_em", desde).lt("concluida_em", antesDe);
    }
    if (f.responsavel === SEM_RESPONSAVEL) q = q.is("responsavel_id", null);
    else if (f.responsavel) q = q.eq("responsavel_id", f.responsavel);
    for (const palavra of palavrasBusca(f.q)) q = q.ilike("titulo", `%${palavra}%`);
    return q
      .order("concluida_em", { ascending: false })
      .order("id")
      .range(de, ate);
  });
  return linhas.map(({ concluida_em, concluida_por, ...l }) => ({
    ...paraAtividadeQuadro(l),
    concluida_em,
    concluida_por,
  }));
}

/** Id do usuário logado (claims do JWT). Uma leitura por requisição. */
export const usuarioLogadoId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims.sub === "string" ? data.claims.sub : null;
});
