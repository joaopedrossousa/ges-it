import { cache } from "react";

import {
  SEM_RESPONSAVEL,
  type AtividadeQuadro,
  type CategoriaKanban,
  type ColunaQuadro,
  type UsuarioSistema,
} from "@/lib/atividades";
import type { PrioridadeAtividade } from "@/lib/types";
import { palavrasBusca } from "@/lib/busca";
import { intervaloDoMes, type FiltrosConcluidas } from "@/lib/filtros-concluidas";
import { buscarTodas } from "@/lib/relatorios/comum";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

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

/**
 * Campos da tela e do relatório de Concluídas (os do quadro mais a conclusão,
 * migration 028). filtro_categoria repete as categorias só para filtrar por
 * uma delas sem cortar as outras da lista (o filtro age sobre o apelido).
 */
const SELECT_CONCLUIDA =
  "id, coluna_id, titulo, prioridade, responsavel_id, prazo, criado_por, created_at, updated_at, urgente, urgente_por, urgente_em, concluida_em, concluida_por, kanban_atividade_categorias(categoria_id), filtro_categoria:kanban_atividade_categorias(categoria_id)";

export type AtividadeConcluida = AtividadeQuadro & {
  concluida_em: string | null;
  concluida_por: string | null;
};

/** Filtros da consulta de concluídas (tela e relatório). */
export type ConsultaConcluidas = {
  /** Início (inclusivo) e fim (exclusivo) da conclusão, com fuso; sem eles, todas as datas. */
  desde?: string;
  antesDe?: string;
  /** "" (todos), uuid ou SEM_RESPONSAVEL. */
  responsavel: string;
  /** Busca no título (todas as palavras). */
  q: string;
  /** Coluna de origem (só no relatório). */
  coluna?: string;
  categoria?: string;
  prioridade?: PrioridadeAtividade;
};

/**
 * Concluídas (arquivada no banco), da conclusão mais recente para a mais
 * antiga, em lotes (o PostgREST devolve até 1.000 por resposta). Recebe o
 * cliente para servir também ao gerador de relatório.
 */
export async function consultarAtividadesConcluidas(
  supabase: Supabase,
  f: ConsultaConcluidas,
): Promise<AtividadeConcluida[]> {
  const linhas = await buscarTodas((de, ate) => {
    let q = supabase.from("kanban_atividades").select(SELECT_CONCLUIDA).eq("arquivada", true);
    if (f.desde) q = q.gte("concluida_em", f.desde);
    if (f.antesDe) q = q.lt("concluida_em", f.antesDe);
    if (f.responsavel === SEM_RESPONSAVEL) q = q.is("responsavel_id", null);
    else if (f.responsavel) q = q.eq("responsavel_id", f.responsavel);
    if (f.coluna) q = q.eq("coluna_id", f.coluna);
    if (f.prioridade) q = q.eq("prioridade", f.prioridade);
    if (f.categoria) {
      // Só as que têm a categoria (o apelido vira um inner join).
      q = q.eq("filtro_categoria.categoria_id", f.categoria).not("filtro_categoria", "is", null);
    }
    for (const palavra of palavrasBusca(f.q)) q = q.ilike("titulo", `%${palavra}%`);
    return q
      .order("concluida_em", { ascending: false })
      .order("id")
      .range(de, ate);
  });
  // filtro_categoria só serve ao filtro: fica fora do objeto (que vai para o cliente).
  return linhas.map(({ concluida_em, concluida_por, filtro_categoria, ...l }) => {
    void filtro_categoria;
    return { ...paraAtividadeQuadro(l), concluida_em, concluida_por };
  });
}

/** Concluídas com os filtros da tela (mês da conclusão em Palmas). */
export async function listarAtividadesConcluidas(f: FiltrosConcluidas): Promise<AtividadeConcluida[]> {
  const supabase = await createClient();
  return consultarAtividadesConcluidas(supabase, {
    ...(f.mes ? intervaloDoMes(f.mes) : {}),
    responsavel: f.responsavel,
    q: f.q,
  });
}

/**
 * Número de comentários por atividade (vw_kanban_comentarios_contagem), só
 * das atividades pedidas, em lotes de ids (a URL tem limite de tamanho).
 */
export async function contarComentarios(supabase: Supabase, ids: string[]): Promise<Map<string, number>> {
  const LOTE_IDS = 100;
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += LOTE_IDS) lotes.push(ids.slice(i, i + LOTE_IDS));
  const respostas = await Promise.all(
    lotes.map((lote) =>
      supabase.from("vw_kanban_comentarios_contagem").select("atividade_id, total").in("atividade_id", lote),
    ),
  );
  const mapa = new Map<string, number>();
  for (const { data, error } of respostas) {
    if (error) throw new Error(error.message);
    for (const c of data) if (c.atividade_id) mapa.set(c.atividade_id, c.total ?? 0);
  }
  return mapa;
}

/** Id do usuário logado (claims do JWT). Uma leitura por requisição. */
export const usuarioLogadoId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims.sub === "string" ? data.claims.sub : null;
});
