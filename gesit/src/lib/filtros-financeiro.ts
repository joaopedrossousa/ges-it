import { z } from "zod";

import { limparBusca, primeiro } from "@/lib/busca";
import { SITUACOES_VENCIMENTO, lerMes, type SituacaoVencimento } from "@/lib/financeiro";
import {
  SITUACOES_PAGAMENTO,
  TIPOS_DESPESA,
  type SituacaoPagamento,
  type TipoDespesa,
} from "@/lib/types";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function leitor(params: Params) {
  return (chave: string) =>
    params instanceof URLSearchParams ? (params.get(chave) ?? undefined) : primeiro(params[chave]);
}

const tipoSchema = z.enum(TIPOS_DESPESA);
const situacaoSchema = z.enum(SITUACOES_PAGAMENTO);
const vencimentoSchema = z.enum(SITUACOES_VENCIMENTO);

/** Filtros de /financeiro/lancamentos. */
export type FiltrosLancamentos = {
  /** "AAAA-MM"; padrão: mês atual em Palmas. */
  mes: string;
  tipo?: TipoDespesa;
  situacao?: SituacaoPagamento;
  vencimento?: SituacaoVencimento;
  lojaId?: string;
  /** Descrição, identificador do serviço ou ID de aprovação. */
  busca: string;
};

/** Lê ?mes, ?tipo, ?situacao, ?venc, ?loja e ?q; valores inválidos são ignorados. */
export function lerFiltrosLancamentos(params: Params, agora = new Date()): FiltrosLancamentos {
  const ler = leitor(params);
  const loja = ler("loja");
  return {
    mes: lerMes(ler("mes"), agora),
    tipo: tipoSchema.safeParse(ler("tipo")).data,
    situacao: situacaoSchema.safeParse(ler("situacao")).data,
    vencimento: vencimentoSchema.safeParse(ler("venc")).data,
    lojaId: z.uuid().safeParse(loja).success ? loja : undefined,
    busca: limparBusca(ler("q") ?? "").slice(0, 100),
  };
}

/** Filtros de /financeiro/servicos. */
export type FiltrosServicosFinanceiros = {
  tipo?: TipoDespesa;
  /** undefined = todos. */
  ativo?: boolean;
};

/** Lê ?tipo e ?ativo ("sim" | "nao"). */
export function lerFiltrosServicosFinanceiros(params: Params): FiltrosServicosFinanceiros {
  const ler = leitor(params);
  const ativo = ler("ativo");
  return {
    tipo: tipoSchema.safeParse(ler("tipo")).data,
    ativo: ativo === "sim" ? true : ativo === "nao" ? false : undefined,
  };
}
