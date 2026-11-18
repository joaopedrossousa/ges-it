import { z } from "zod";

import { PRIORIDADE_LABEL, SEM_RESPONSAVEL } from "@/lib/atividades";
import {
  consultarAtividadesConcluidas,
  contarComentarios,
  type ConsultaConcluidas,
} from "@/lib/atividades-servidor";
import { formatarMes } from "@/lib/financeiro";
import { intervaloDoMes, lerFiltrosConcluidas } from "@/lib/filtros-concluidas";
import { PRIORIDADES_ATIVIDADE } from "@/lib/types";
import { nomesDeUsuarios } from "@/lib/usuarios-servidor";

import { buscarTodas, dataBR, dataSemHora, diaSeguinte, type Gerador, type Supabase } from "./comum";
import { ErroRelatorio, type QuadroResumo } from "./tipos";

/**
 * Relatórios de Atividades. "atividades-concluidas" sai de dois lugares:
 * - tela Atividades > Concluídas: ?mes=AAAA-MM|tudo, ?responsavel, ?q
 *   (os mesmos parâmetros da URL da tela; sem ?mes, o mês atual em Palmas);
 * - tela Relatórios: ?mes ou ?de/?ate (intervalo de datas da conclusão),
 *   ?responsavel, ?coluna, ?categoria e ?prioridade.
 */

const uuid = z.uuid();
const dataSchema = z.iso.date();
const prioridadeSchema = z.enum(PRIORIDADES_ATIVIDADE);

const uuidDe = (params: URLSearchParams, chave: string) => {
  const v = params.get(chave);
  return v && uuid.safeParse(v).success ? v : undefined;
};

type Periodo =
  | { tipo: "mes"; mes: string }
  | { tipo: "todos" }
  | { tipo: "intervalo"; de: string; ate: string };

function lerParametros(params: URLSearchParams, agora: Date) {
  const tela = lerFiltrosConcluidas(Object.fromEntries(params), agora);
  const de = params.get("de");
  const ate = params.get("ate");

  let periodo: Periodo;
  if (de || ate) {
    if (!de || !ate || !dataSchema.safeParse(de).success || !dataSchema.safeParse(ate).success) {
      throw new ErroRelatorio(400, "Informe datas válidas para o período.");
    }
    if (de > ate) throw new ErroRelatorio(400, "A data inicial deve ser anterior ou igual à final.");
    periodo = { tipo: "intervalo", de, ate };
  } else {
    periodo = tela.mes ? { tipo: "mes", mes: tela.mes } : { tipo: "todos" };
  }

  const consulta: ConsultaConcluidas = {
    ...(periodo.tipo === "mes"
      ? intervaloDoMes(periodo.mes)
      : periodo.tipo === "intervalo"
        ? {
            // Palmas é UTC−3 o ano todo.
            desde: `${periodo.de}T00:00:00-03:00`,
            antesDe: `${diaSeguinte(periodo.ate)}T00:00:00-03:00`,
          }
        : {}),
    responsavel: tela.responsavel,
    q: tela.q,
    coluna: uuidDe(params, "coluna"),
    categoria: uuidDe(params, "categoria"),
    prioridade: prioridadeSchema.safeParse(params.get("prioridade")).data,
  };
  return { periodo, consulta };
}

const rotuloPeriodo = (p: Periodo) =>
  p.tipo === "mes"
    ? formatarMes(p.mes)
    : p.tipo === "intervalo"
      ? `${dataBR(p.de)} a ${dataBR(p.ate)}`
      : "Todos os meses";

/** Parte do nome do arquivo: "2026-11", "todos" ou "2026-10-01-a-2026-11-15". */
const sufixoArquivo = (p: Periodo) =>
  p.tipo === "mes" ? p.mes : p.tipo === "intervalo" ? `${p.de}-a-${p.ate}` : "todos";

async function carregarApoio(supabase: Supabase) {
  const [colunas, categorias] = await Promise.all([
    buscarTodas((a, b) =>
      supabase.from("kanban_colunas").select("id, nome, arquivada").order("id").range(a, b),
    ),
    buscarTodas((a, b) =>
      supabase.from("kanban_categorias").select("id, nome, ativa").order("id").range(a, b),
    ),
  ]);
  return {
    colunas: new Map(colunas.map((c) => [c.id, c])),
    categorias: new Map(categorias.map((c) => [c.id, c])),
  };
}

const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });

const atividadesConcluidas: Gerador = async (supabase, params, agora) => {
  const { periodo, consulta } = lerParametros(params, agora);
  const [atividades, apoio] = await Promise.all([
    consultarAtividadesConcluidas(supabase, consulta),
    carregarApoio(supabase),
  ]);

  const responsavelFiltro =
    consulta.responsavel && consulta.responsavel !== SEM_RESPONSAVEL ? consulta.responsavel : null;
  const [comentarios, usuarios] = await Promise.all([
    contarComentarios(supabase, atividades.map((a) => a.id)),
    // Responsáveis, autores da conclusão e o responsável do filtro (mesmo sem atividades).
    nomesDeUsuarios(supabase, [
      ...atividades.flatMap((a) => [a.responsavel_id, a.concluida_por]),
      responsavelFiltro,
    ]),
  ]);
  const nome = (id: string) => usuarios.get(id)?.nome ?? "Usuário removido";

  const nomeColuna = (id: string) => {
    const c = apoio.colunas.get(id);
    return c ? `${c.nome}${c.arquivada ? " (arquivada)" : ""}` : "Coluna removida";
  };

  // Cabeçalho: o período e só os filtros aplicados.
  const filtros = [
    { rotulo: "Período da Conclusão", valor: rotuloPeriodo(periodo) },
    consulta.responsavel && {
      rotulo: "Responsável",
      valor: responsavelFiltro ? nome(responsavelFiltro) : "Sem responsável",
    },
    consulta.coluna && { rotulo: "Coluna de Origem", valor: nomeColuna(consulta.coluna) },
    consulta.categoria && {
      rotulo: "Categoria",
      valor: apoio.categorias.get(consulta.categoria)?.nome ?? "Categoria não encontrada",
    },
    consulta.prioridade && { rotulo: "Prioridade", valor: PRIORIDADE_LABEL[consulta.prioridade] },
    consulta.q && { rotulo: "Busca no Título", valor: `"${consulta.q}"` },
  ].filter((x) => !!x);

  // Resumo: por responsável (mais atividades primeiro; "Sem responsável" no fim) e por prioridade.
  const contagem = new Map<string | null, number>();
  for (const a of atividades) contagem.set(a.responsavel_id, (contagem.get(a.responsavel_id) ?? 0) + 1);
  const porResponsavel = [...contagem]
    .filter(([id]) => id !== null)
    .map(([id, valor]) => ({ rotulo: nome(id!), valor }))
    .sort((a, b) => b.valor - a.valor || porNome(a.rotulo, b.rotulo));
  const semResponsavel = contagem.get(null);
  if (semResponsavel) porResponsavel.push({ rotulo: "Sem responsável", valor: semResponsavel });

  const quadrosResumo: QuadroResumo[] = [
    { titulo: "Por Responsável", colunas: ["Responsável", "Atividades"], itens: porResponsavel },
    {
      titulo: "Por Prioridade",
      colunas: ["Prioridade", "Atividades"],
      itens: PRIORIDADES_ATIVIDADE.flatMap((p) => {
        const valor = atividades.filter((a) => a.prioridade === p).length;
        return valor ? [{ rotulo: PRIORIDADE_LABEL[p], valor }] : [];
      }),
    },
  ];

  return {
    slug: "atividades-concluidas",
    arquivo: `atividades-concluidas-${sufixoArquivo(periodo)}`,
    titulo: "Atividades Concluídas",
    aba: "Concluídas",
    orientacao: "retrato",
    filtros,
    colunas: [
      { chave: "titulo", titulo: "Título" },
      { chave: "coluna", titulo: "Coluna de Origem" },
      { chave: "responsavel", titulo: "Responsável" },
      { chave: "categorias", titulo: "Categorias" },
      { chave: "prioridade", titulo: "Prioridade" },
      { chave: "urgente", titulo: "Urgente" },
      { chave: "prazo", titulo: "Prazo", tipo: "data" },
      { chave: "concluida_em", titulo: "Concluída em", tipo: "dataHora" },
      { chave: "concluida_por", titulo: "Concluída por" },
      { chave: "criada_em", titulo: "Criada em", tipo: "dataHora" },
      { chave: "comentarios", titulo: "Nº de Comentários", tipo: "numero" },
    ],
    // PDF enxuto (retrato): o Excel traz o restante.
    colunasPdf: [
      { chave: "titulo", titulo: "Título", peso: 3 },
      { chave: "responsavel", titulo: "Responsável", peso: 1.4 },
      { chave: "prioridade", titulo: "Prioridade", peso: 0.7 },
      { chave: "concluida_em", titulo: "Concluída em", tipo: "dataHora", peso: 1.05 },
      { chave: "concluida_por", titulo: "Concluída por", peso: 1.4 },
    ],
    // Já na ordem da consulta: conclusão mais recente primeiro.
    linhas: atividades.map((a) => ({
      titulo: a.titulo,
      coluna: nomeColuna(a.coluna_id),
      responsavel: a.responsavel_id ? nome(a.responsavel_id) : null,
      categorias:
        a.categorias
          .map((id) => apoio.categorias.get(id)?.nome)
          .filter((n): n is string => Boolean(n))
          .sort(porNome)
          .join(", ") || null,
      prioridade: PRIORIDADE_LABEL[a.prioridade],
      urgente: a.urgente ? "Sim" : "Não",
      prazo: dataSemHora(a.prazo),
      concluida_em: a.concluida_em ? new Date(a.concluida_em) : null,
      concluida_por: a.concluida_por ? nome(a.concluida_por) : "Autor não registrado",
      criada_em: new Date(a.created_at),
      comentarios: comentarios.get(a.id) ?? 0,
    })),
    unidade: ["atividade", "atividades"],
    quadrosResumo,
    vazio: "Nenhuma atividade concluída com esses filtros.",
  };
};

export const GERADORES_ATIVIDADES = {
  "atividades-concluidas": atividadesConcluidas,
} satisfies Record<string, Gerador>;
