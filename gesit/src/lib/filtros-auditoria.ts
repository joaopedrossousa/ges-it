import { z } from "zod";

import {
  ACOES_AUDITORIA,
  TABELAS_AUDITORIA,
  type AcaoAuditoria,
  type TabelaAuditoria,
} from "@/lib/auditoria";
import { primeiro } from "@/lib/busca";

/** Filtros de /auditoria (também usados na exportação em Excel). */
export type FiltrosAuditoria = {
  /** "AAAA-MM-DD", dias inteiros no fuso de Palmas. */
  de?: string;
  ate?: string;
  /** auth.users.id de quem fez. */
  usuario?: string;
  tabela?: TabelaAuditoria;
  acao?: AcaoAuditoria;
  /** Um registro só (links "Ver no log completo" dos detalhes). */
  registro?: string;
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

const data = z.iso.date();
const uuid = z.uuid();
const tabela = z.enum(TABELAS_AUDITORIA);
const acao = z.enum(ACOES_AUDITORIA);

/** Lê ?de, ?ate, ?usuario, ?tipo, ?acao e ?registro; valores inválidos são ignorados. */
export function lerFiltrosAuditoria(params: Params): FiltrosAuditoria {
  const ler = (chave: string) =>
    params instanceof URLSearchParams ? (params.get(chave) ?? undefined) : primeiro(params[chave]);
  return {
    de: data.safeParse(ler("de")).data,
    ate: data.safeParse(ler("ate")).data,
    usuario: uuid.safeParse(ler("usuario")).data,
    tabela: tabela.safeParse(ler("tipo")).data,
    acao: acao.safeParse(ler("acao")).data,
    registro: uuid.safeParse(ler("registro")).data,
  };
}

/** Dia seguinte, também como "AAAA-MM-DD". */
function diaSeguinte(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Limites de alterado_em para o PostgREST. Palmas é UTC−3 o ano todo
 * (sem horário de verão desde 2013).
 */
export function limitesPeriodo(f: FiltrosAuditoria) {
  return {
    desde: f.de ? `${f.de}T00:00:00-03:00` : undefined,
    antesDe: f.ate ? `${diaSeguinte(f.ate)}T00:00:00-03:00` : undefined,
  };
}

export function temFiltroAuditoria(f: FiltrosAuditoria) {
  return Boolean(f.de || f.ate || f.usuario || f.tabela || f.acao || f.registro);
}
