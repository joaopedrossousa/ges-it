import { mesesEntre, somarMeses, somarReais } from "@/lib/financeiro";
import type { SituacaoPagamento } from "@/lib/types";

/**
 * Evolução mensal por fornecedor ou por serviço (Painel Financeiro). Mesma
 * regra de valores do gráfico Evolução Mensal: soma de `valor` por
 * competência, cancelados fora. Funções puras: usadas na tela (cliente) e
 * na exportação (servidor).
 */

export type AgrupamentoEvolucao = "fornecedor" | "servico";
export type PeriodoEvolucao = "6m" | "12m" | "ano" | "tudo";

export const PERIODOS_EVOLUCAO: { valor: PeriodoEvolucao; rotulo: string }[] = [
  { valor: "6m", rotulo: "6 meses" },
  { valor: "12m", rotulo: "12 meses" },
  { valor: "ano", rotulo: "Ano atual" },
  { valor: "tudo", rotulo: "Tudo" },
];

export const AGRUPAMENTOS_EVOLUCAO: { valor: AgrupamentoEvolucao; rotulo: string }[] = [
  { valor: "fornecedor", rotulo: "Por fornecedor" },
  { valor: "servico", rotulo: "Por serviço" },
];

export const ehPeriodoEvolucao = (v: unknown): v is PeriodoEvolucao =>
  PERIODOS_EVOLUCAO.some((p) => p.valor === v);
export const ehAgrupamentoEvolucao = (v: unknown): v is AgrupamentoEvolucao =>
  AGRUPAMENTOS_EVOLUCAO.some((a) => a.valor === v);

/** Campos lidos da vw_lancamentos. */
export const SELECT_EVOLUCAO =
  "id, competencia, valor, situacao, fornecedor, servico_id, servico_fornecedor, servico_descricao, servico_identificador";

export type LinhaEvolucao = {
  competencia: string | null;
  valor: number | null;
  situacao: SituacaoPagamento | null;
  fornecedor: string | null;
  servico_id: string | null;
  servico_fornecedor: string | null;
  servico_descricao: string | null;
  servico_identificador: string | null;
};

/** Uma série (fornecedor ou serviço) com o valor e a quantidade por mês ("AAAA-MM"). */
export type SerieEvolucao = {
  chave: string;
  nome: string;
  /** Para o link da lista de lançamentos. */
  filtro: { fornecedor?: string; servico?: string };
  valores: Record<string, number>;
  quantidades: Record<string, number>;
  /**
   * Posição pelo total de TODO o histórico (0 = maior): define a cor e o
   * traço, que não mudam com o período nem com a seleção.
   */
  ordem: number;
};

export type DadosEvolucao = {
  /** Primeiro e último mês com lançamento (null se não houver nenhum). */
  primeiroMes: string | null;
  ultimoMes: string | null;
  fornecedor: SerieEvolucao[];
  servico: SerieEvolucao[];
};

const normalizar = (t: string) => t.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

function nomeServico(l: LinhaEvolucao) {
  const partes = [
    l.servico_fornecedor ?? l.fornecedor,
    l.servico_descricao,
    l.servico_identificador,
  ].filter((p): p is string => Boolean(p && p.trim()));
  return partes.join(" — ") || "Serviço sem nome";
}

/** Agrupa os lançamentos (cancelados fora) por fornecedor e por serviço. */
export function montarEvolucao(linhas: readonly LinhaEvolucao[]): DadosEvolucao {
  const fornecedores = new Map<string, SerieEvolucao>();
  const servicos = new Map<string, SerieEvolucao>();
  let primeiroMes: string | null = null;
  let ultimoMes: string | null = null;

  function somar(mapa: Map<string, SerieEvolucao>, chave: string, base: Omit<SerieEvolucao, "valores" | "quantidades" | "ordem">, mes: string, valor: number) {
    let s = mapa.get(chave);
    if (!s) {
      s = { ...base, valores: {}, quantidades: {}, ordem: 0 };
      mapa.set(chave, s);
    }
    s.valores[mes] = somarReais(s.valores[mes] ?? 0, valor);
    s.quantidades[mes] = (s.quantidades[mes] ?? 0) + 1;
  }

  for (const l of linhas) {
    if (!l.situacao || l.situacao === "cancelado" || !l.competencia) continue;
    const mes = l.competencia.slice(0, 7);
    const valor = l.valor ?? 0;
    if (!primeiroMes || mes < primeiroMes) primeiroMes = mes;
    if (!ultimoMes || mes > ultimoMes) ultimoMes = mes;

    const fornecedor = (l.fornecedor ?? "").trim() || "Sem fornecedor";
    const chaveFornecedor = normalizar(fornecedor);
    somar(fornecedores, chaveFornecedor, { chave: `f:${chaveFornecedor}`, nome: fornecedor, filtro: { fornecedor } }, mes, valor);

    if (l.servico_id) {
      somar(servicos, l.servico_id, { chave: `s:${l.servico_id}`, nome: nomeServico(l), filtro: { servico: l.servico_id } }, mes, valor);
    } else {
      // Avulsos agrupados por fornecedor.
      somar(
        servicos,
        `avulso:${chaveFornecedor}`,
        { chave: `a:${chaveFornecedor}`, nome: `Avulsos — ${fornecedor}`, filtro: { servico: "avulso", fornecedor } },
        mes,
        valor,
      );
    }
  }

  const ordenar = (mapa: Map<string, SerieEvolucao>) => {
    const lista = [...mapa.values()];
    const total = (s: SerieEvolucao) => Object.values(s.valores).reduce((a, b) => somarReais(a, b), 0);
    lista.sort((a, b) => total(b) - total(a) || a.nome.localeCompare(b.nome, "pt-BR"));
    lista.forEach((s, i) => (s.ordem = i));
    return lista;
  };

  return { primeiroMes, ultimoMes, fornecedor: ordenar(fornecedores), servico: ordenar(servicos) };
}

/**
 * Meses do período, terminando no mês do Painel (`mesRef`, "AAAA-MM").
 * 12 meses é a mesma janela do gráfico Evolução Mensal (os totais batem).
 */
export function mesesDoPeriodo(
  periodo: PeriodoEvolucao,
  mesRef: string,
  dados: Pick<DadosEvolucao, "primeiroMes" | "ultimoMes">,
): string[] {
  switch (periodo) {
    case "6m":
      return mesesEntre(somarMeses(mesRef, -5), mesRef);
    case "12m":
      return mesesEntre(somarMeses(mesRef, -11), mesRef);
    case "ano":
      return mesesEntre(`${mesRef.slice(0, 4)}-01`, mesRef);
    case "tudo": {
      const inicio = dados.primeiroMes && dados.primeiroMes < mesRef ? dados.primeiroMes : mesRef;
      const fim = dados.ultimoMes && dados.ultimoMes > mesRef ? dados.ultimoMes : mesRef;
      return mesesEntre(inicio, fim);
    }
  }
}

export type LinhaTabelaEvolucao = {
  serie: SerieEvolucao;
  valores: number[];
  total: number;
  media: number;
  /** Variação do último mês contra o anterior, em %. null = sem base (ver `novo`). */
  variacao: number | null;
  /** Anterior zerado e último com valor. */
  novo: boolean;
};

/** Variação % do último mês contra o anterior. */
export function variacaoUltimoMes(valores: readonly number[]): { variacao: number | null; novo: boolean } {
  if (valores.length < 2) return { variacao: null, novo: false };
  const ultimo = valores[valores.length - 1];
  const anterior = valores[valores.length - 2];
  if (anterior === 0) return { variacao: null, novo: ultimo > 0 };
  return { variacao: ((ultimo - anterior) / anterior) * 100, novo: false };
}

/**
 * Uma linha por série com lançamento no período (mesmo que de valor zero),
 * ordenada pelo total; e o total geral por mês.
 */
export function tabelaEvolucao(series: readonly SerieEvolucao[], meses: readonly string[]) {
  const linhas: LinhaTabelaEvolucao[] = series
    .filter((s) => meses.some((m) => (s.quantidades[m] ?? 0) > 0))
    .map((s) => {
      const valores = meses.map((m) => s.valores[m] ?? 0);
      const total = valores.reduce((a, b) => somarReais(a, b), 0);
      return {
        serie: s,
        valores,
        total,
        media: meses.length ? Math.round((total / meses.length) * 100) / 100 : 0,
        ...variacaoUltimoMes(valores),
      };
    })
    .sort((a, b) => b.total - a.total || a.serie.nome.localeCompare(b.serie.nome, "pt-BR"));

  const totais = meses.map((_, i) => linhas.reduce((s, l) => somarReais(s, l.valores[i]), 0));
  const totalGeral = totais.reduce((a, b) => somarReais(a, b), 0);
  return {
    linhas,
    totais,
    totalGeral,
    mediaGeral: meses.length ? Math.round((totalGeral / meses.length) * 100) / 100 : 0,
    variacaoGeral: variacaoUltimoMes(totais),
  };
}

/** Link da lista de lançamentos de um mês filtrada pela série. */
export function hrefLancamentosDaSerie(serie: SerieEvolucao, mes: string) {
  const params = new URLSearchParams({ mes });
  if (serie.filtro.fornecedor) params.set("fornecedor", serie.filtro.fornecedor);
  if (serie.filtro.servico) params.set("servico", serie.filtro.servico);
  return `/financeiro/lancamentos?${params}`;
}

/** "+12,3%", "−4,0%", "Novo", "—". */
export function textoVariacao(v: { variacao: number | null; novo: boolean }): string {
  if (v.novo) return "Novo";
  if (v.variacao === null) return "—";
  const n = Math.abs(v.variacao).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return v.variacao > 0 ? `+${n}%` : v.variacao < 0 ? `−${n}%` : "0,0%";
}
