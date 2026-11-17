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
  provedor_internet: "Provedor de internet",
  servico: "Serviço",
  telefonia: "Telefonia",
  compras: "Compras",
  outro: "Outro",
};

export const SITUACAO_PAGAMENTO_LABEL: Record<SituacaoPagamento, string> = {
  solicitado_compras: "Solicitado ao Compras",
  enviado_financeiro: "Enviado ao Financeiro",
  pago: "Pago",
  nao_pago: "Não pago",
  cancelado: "Cancelado",
};

/** situacao_vencimento da vw_lancamentos. */
export const SITUACOES_VENCIMENTO = ["vencido", "proximo", "a_vencer", "pago", "cancelado"] as const;
export type SituacaoVencimento = (typeof SITUACOES_VENCIMENTO)[number];

export const SITUACAO_VENCIMENTO_LABEL: Record<SituacaoVencimento, string> = {
  vencido: "Vencido",
  proximo: "Vence em até 5 dias",
  a_vencer: "A vencer",
  pago: "Pago",
  cancelado: "Cancelado",
};

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
};

type LinhaResumo = {
  valor: number | null;
  situacao: SituacaoPagamento | null;
  situacao_vencimento: string | null;
};

const zero = (): Total => ({ valor: 0, quantidade: 0 });

function somar(t: Total, valor: number) {
  // Centavos inteiros: evita 0,1 + 0,2 = 0,30000000000000004.
  t.valor = Math.round((t.valor + valor) * 100) / 100;
  t.quantidade += 1;
}

export function resumirLancamentos(linhas: readonly LinhaResumo[]): ResumoLancamentos {
  const r: ResumoLancamentos = { total: zero(), pago: zero(), aberto: zero(), vencido: zero() };
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
  }
  return r;
}

/** Total sem os cancelados (subtotais da tabela). */
export function somarValores(linhas: readonly LinhaResumo[]): number {
  return resumirLancamentos(linhas).total.valor;
}
