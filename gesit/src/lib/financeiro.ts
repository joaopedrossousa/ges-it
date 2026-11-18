import { hojeEmPalmas } from "@/lib/format";
import {
  SITUACOES_PAGAMENTO,
  TIPOS_DESPESA,
  type SituacaoPagamento,
  type TipoDespesa,
} from "@/lib/types";

/**
 * Gestão Financeira (migration 015): rótulos, competência (mês) e totais.
 * Sem acesso ao banco: serve ao servidor e ao navegador.
 */

// ===========================================================================
// Rótulos
// ===========================================================================

export const TIPO_DESPESA_LABEL: Record<TipoDespesa, string> = {
  provedor_internet: "Provedor de Internet",
  servico: "Serviço",
  telefonia: "Telefonia",
  compras: "Compras",
  outro: "Outro",
};

export const SITUACAO_PAGAMENTO_LABEL: Record<SituacaoPagamento, string> = {
  solicitado_compras: "Solicitado Compras",
  enviado_financeiro: "Enviado Financeiro",
  pago: "Pago",
  nao_pago: "Não Pago",
  cancelado: "Cancelado",
};

/** situacao_vencimento da vw_lancamentos (migration 016). */
export const SITUACOES_VENCIMENTO = [
  "vencido",
  "hoje",
  "proximo",
  "a_vencer",
  "pago",
  "cancelado",
] as const;
export type SituacaoVencimento = (typeof SITUACOES_VENCIMENTO)[number];

/** Rótulo fixo (filtros). Na linha, use rotuloVencimento, com os dias. */
export const SITUACAO_VENCIMENTO_LABEL: Record<SituacaoVencimento, string> = {
  vencido: "Vencido",
  hoje: "Vence Hoje",
  proximo: "Vence em 1 a 5 Dias",
  a_vencer: "A Vencer",
  pago: "Pago",
  cancelado: "Cancelado",
};

/**
 * Com os dias (dias_para_vencer): "Vence Amanhã", "Vence em 3 Dias",
 * "Vencido Ontem", "Vencido há 12 Dias". Sem eles, o rótulo fixo.
 */
export function rotuloVencimento(situacao: SituacaoVencimento, dias: number | null): string {
  if (dias === null) return SITUACAO_VENCIMENTO_LABEL[situacao];
  if (situacao === "proximo") return dias === 1 ? "Vence Amanhã" : `Vence em ${dias} Dias`;
  if (situacao === "vencido" && dias < 0) {
    return dias === -1 ? "Vencido Ontem" : `Vencido há ${-dias} Dias`;
  }
  return SITUACAO_VENCIMENTO_LABEL[situacao];
}

// ===========================================================================
// Nome do serviço / lançamento: "Fornecedor · descrição · identificador"
// ===========================================================================

type Nomeavel = {
  fornecedor: string | null;
  descricao?: string | null;
  identificador?: string | null;
};

/** Linha secundária: descrição e identificador, quando houver. */
export function detalheFinanceiro({ descricao, identificador }: Nomeavel): string {
  return [descricao, identificador].filter(Boolean).join(" · ");
}

/** Nome completo em uma linha (comboboxes, avisos, auditoria, relatórios). */
/**
 * Link para a linha do lançamento na tela do mês (destacada pelo #id). Use
 * com <a>, não <Link>: a navegação completa leva ao #id (a linha chega em
 * streaming) e ativa o :target.
 */
export const hrefLancamento = (id: string, competencia: string) =>
  `/financeiro/lancamentos?mes=${competencia.slice(0, 7)}#lanc-${id}`;

export function nomeFinanceiro(item: Nomeavel): string {
  return [item.fornecedor || "—", detalheFinanceiro(item)].filter(Boolean).join(" · ");
}

export function paraSituacaoVencimento(valor: unknown): SituacaoVencimento | null {
  return (SITUACOES_VENCIMENTO as readonly unknown[]).includes(valor)
    ? (valor as SituacaoVencimento)
    : null;
}

export function ehTipoDespesa(valor: unknown): valor is TipoDespesa {
  return (TIPOS_DESPESA as readonly unknown[]).includes(valor);
}

export function ehSituacaoPagamento(valor: unknown): valor is SituacaoPagamento {
  return (SITUACOES_PAGAMENTO as readonly unknown[]).includes(valor);
}

/** Aprovação: null = não informado. */
export function rotuloAprovacao(ok: boolean | null | undefined): string {
  return ok === true ? "OK" : ok === false ? "Não OK" : "—";
}

// ===========================================================================
// Competência ("AAAA-MM" na URL; "AAAA-MM-01" no banco)
// ===========================================================================

export const REGEX_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Mês atual em Palmas: "AAAA-MM". */
export function mesAtualEmPalmas(agora = new Date()): string {
  return hojeEmPalmas(agora).slice(0, 7);
}

/** ?mes= válido, ou o mês atual em Palmas. */
export function lerMes(valor: string | undefined | null, agora = new Date()): string {
  return valor && REGEX_MES.test(valor) ? valor : mesAtualEmPalmas(agora);
}

/** "2026-11" → "2026-11-01". */
export function competenciaDoMes(mes: string): string {
  return `${mes.slice(0, 7)}-01`;
}

/** "2026-11" ou "2026-11-01" → "Novembro de 2026". */
export function formatarMes(mesOuCompetencia: string): string {
  const ano = mesOuCompetencia.slice(0, 4);
  const mes = Number(mesOuCompetencia.slice(5, 7));
  return `${MESES[mes - 1] ?? "?"} de ${ano}`;
}

/** "2026-11-01" → "11/2026". */
export function formatarCompetenciaCurta(competencia: string): string {
  return `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
}

/** Soma (ou subtrai) meses: somarMeses("2026-01", -1) = "2025-12". */
export function somarMeses(mes: string, n: number): string {
  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  const ano = Math.floor(total / 12);
  return `${ano}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Meses de `antes` meses antes até `depois` meses depois do mês dado, em ordem. */
export function mesesAoRedor(mes: string, antes = 12, depois = 12): string[] {
  return Array.from({ length: antes + depois + 1 }, (_, i) => somarMeses(mes, i - antes));
}

/**
 * Vencimento no mês da competência pelo dia do catálogo. Dia maior que o
 * último do mês (ex.: 31 em fevereiro) vira o último dia.
 */
export function vencimentoNoMes(competencia: string, dia: number): string {
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${competencia.slice(0, 7)}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

// ===========================================================================
// Totais
// ===========================================================================

export type Total = { valor: number; quantidade: number };

export type ResumoLancamentos = {
  /** Pago + em aberto (cancelados ficam fora). */
  total: Total;
  pago: Total;
  /** Solicitado, enviado ao Financeiro ou não pago. */
  aberto: Total;
  /** Em aberto com vencimento já passado. */
  vencido: Total;
  /** Ver aguardandoAprovacao. */
  aguardando: Total;
};

type LinhaResumo = {
  valor: number | null;
  situacao: SituacaoPagamento | null;
  situacao_vencimento: string | null;
  aprovacao_ok?: boolean | null;
};

/**
 * Aguardando aprovação: aprovação "Não OK" ou, ainda sem aprovação
 * informada, na situação Solicitado Compras. Cancelados não contam.
 */
export function aguardandoAprovacao(l: {
  situacao: SituacaoPagamento | null;
  aprovacao_ok?: boolean | null;
}): boolean {
  if (!l.situacao || l.situacao === "cancelado") return false;
  return (
    l.aprovacao_ok === false || (l.aprovacao_ok == null && l.situacao === "solicitado_compras")
  );
}

/** Filtro do PostgREST equivalente a aguardandoAprovacao (com .neq("situacao", "cancelado")). */
export const FILTRO_AGUARDANDO_APROVACAO =
  "aprovacao_ok.eq.false,and(aprovacao_ok.is.null,situacao.eq.solicitado_compras)";

const zero = (): Total => ({ valor: 0, quantidade: 0 });

/** Soma em centavos inteiros: evita 0,1 + 0,2 = 0,30000000000000004. */
export function somarReais(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

function somar(t: Total, valor: number) {
  t.valor = somarReais(t.valor, valor);
  t.quantidade += 1;
}

export function resumirLancamentos(linhas: readonly LinhaResumo[]): ResumoLancamentos {
  const r: ResumoLancamentos = {
    total: zero(),
    pago: zero(),
    aberto: zero(),
    vencido: zero(),
    aguardando: zero(),
  };
  for (const l of linhas) {
    if (!l.situacao || l.situacao === "cancelado") continue;
    const valor = l.valor ?? 0;
    somar(r.total, valor);
    if (l.situacao === "pago") {
      somar(r.pago, valor);
    } else {
      somar(r.aberto, valor);
      if (l.situacao_vencimento === "vencido") somar(r.vencido, valor);
    }
    if (aguardandoAprovacao(l)) somar(r.aguardando, valor);
  }
  return r;
}

/** Total sem os cancelados (subtotais da tabela). */
export function somarValores(linhas: readonly LinhaResumo[]): number {
  return resumirLancamentos(linhas).total.valor;
}

/**
 * "+7% vs outubro", "−3% vs outubro", "Igual a outubro" ou, sem gasto no
 * mês anterior, "Sem gastos em outubro". `mes` é o mês atual ("AAAA-MM").
 */
export function comparacaoMesAnterior(atual: number, anterior: number, mes: string): string {
  const nome = nomeDoMes(somarMeses(mes, -1)).toLowerCase();
  if (anterior === 0) return atual === 0 ? `Sem gastos também em ${nome}` : `Sem gastos em ${nome}`;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return `Igual a ${nome}`;
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% vs ${nome}`;
}

/** "2026-11" → "Novembro". */
export function nomeDoMes(mes: string): string {
  return MESES[Number(mes.slice(5, 7)) - 1] ?? "?";
}

/** "2026-11" → "nov/26" (eixos de gráfico). */
export function mesCurto(mes: string): string {
  return `${nomeDoMes(mes).slice(0, 3).toLowerCase()}/${mes.slice(2, 4)}`;
}

/** Meses de `de` a `ate` ("AAAA-MM"), inclusive. Vazio se de > ate. */
export function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = [];
  for (let m = de; m <= ate; m = somarMeses(m, 1)) meses.push(m);
  return meses;
}

/** Linha para os gráficos e somas por tipo/filial. */
type LinhaGasto = {
  competencia: string | null;
  tipo: TipoDespesa | null;
  loja_id: string | null;
  valor: number | null;
  situacao: SituacaoPagamento | null;
};

const conta = (l: LinhaGasto) => l.situacao !== null && l.situacao !== "cancelado";

/** Valor por tipo (cancelados fora), na ordem fixa dos tipos. */
export function gastosPorTipo(linhas: readonly LinhaGasto[]): Record<TipoDespesa, number> {
  const soma = Object.fromEntries(TIPOS_DESPESA.map((t) => [t, 0])) as Record<TipoDespesa, number>;
  for (const l of linhas) {
    if (conta(l) && l.tipo) soma[l.tipo] = somarReais(soma[l.tipo], l.valor ?? 0);
  }
  return soma;
}

/** Valor por loja_id (null = sem filial, "Geral"), cancelados fora. */
export function gastosPorFilial(linhas: readonly LinhaGasto[]): Map<string | null, number> {
  const soma = new Map<string | null, number>();
  for (const l of linhas) {
    if (conta(l)) soma.set(l.loja_id, somarReais(soma.get(l.loja_id) ?? 0, l.valor ?? 0));
  }
  return soma;
}

/** Por competência ("AAAA-MM") e tipo, para os meses pedidos (meses sem gasto ficam zerados). */
export function gastosPorMes(
  linhas: readonly LinhaGasto[],
  meses: readonly string[],
): { mes: string; porTipo: Record<TipoDespesa, number>; total: number }[] {
  return meses.map((mes) => {
    const doMes = linhas.filter((l) => l.competencia?.slice(0, 7) === mes);
    const porTipo = gastosPorTipo(doMes);
    return { mes, porTipo, total: TIPOS_DESPESA.reduce((s, t) => somarReais(s, porTipo[t]), 0) };
  });
}
