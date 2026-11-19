import { z } from "zod";

import { limparBusca, primeiro } from "@/lib/busca";
import {
  FILTRO_DADOS_PENDENTES,
  SITUACAO_PADRAO,
  SITUACOES_COLABORADOR,
  type SituacaoColaborador,
} from "@/lib/colaboradores";
import { somenteDigitos } from "@/lib/validators";

/** Filtros da listagem /colaboradores (também usados no relatório "colaboradores"). */
export type FiltrosColaboradores = {
  busca: string;
  lojaId?: string;
  situacao: SituacaoColaborador;
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

const situacaoSchema = z.enum(SITUACOES_COLABORADOR);

/** Lê ?q, ?loja e ?situacao; valores inválidos são ignorados (situação volta a "ativos"). */
export function lerFiltrosColaboradores(params: Params): FiltrosColaboradores {
  const ler = (chave: string) =>
    params instanceof URLSearchParams ? (params.get(chave) ?? undefined) : primeiro(params[chave]);

  const loja = ler("loja");
  const situacao = situacaoSchema.safeParse(ler("situacao")).data ?? SITUACAO_PADRAO;
  return {
    busca: limparBusca(ler("q") ?? "").slice(0, 100),
    lojaId: z.uuid().safeParse(loja).success ? loja : undefined,
    situacao,
  };
}

/**
 * Condições para a consulta em colaboradores: `ativo` (eq, se definido),
 * `lojaId` (eq em loja_id) e `ou` (expressão única para .or()).
 * Busca (nome, cargo, e-mail e, com 3+ dígitos, CPF) e pendências são dois
 * "ou" que precisam valer juntos: vão num .or só.
 */
export function condicoesColaboradores(f: FiltrosColaboradores) {
  const busca: string[] = [];
  if (f.busca) {
    busca.push(`nome.ilike.%${f.busca}%`, `cargo.ilike.%${f.busca}%`, `email.ilike.%${f.busca}%`);
    const digitos = somenteDigitos(f.busca);
    if (digitos.length >= 3) busca.push(`cpf.like.%${digitos}%`);
  }
  const pendentes = f.situacao === "pendentes";

  let ou: string | undefined;
  if (busca.length && pendentes) ou = `and(or(${FILTRO_DADOS_PENDENTES}),or(${busca.join(",")}))`;
  else if (busca.length) ou = busca.join(",");
  else if (pendentes) ou = FILTRO_DADOS_PENDENTES;

  // "Dados pendentes" vale só para os ativos (como o card do Dashboard).
  const ativo =
    f.situacao === "ativos" || f.situacao === "pendentes"
      ? true
      : f.situacao === "inativos"
        ? false
        : undefined;

  return { ativo, lojaId: f.lojaId, ou };
}
