import { z } from "zod";

import { SEM_RESPONSAVEL } from "@/lib/atividades";
import { limparBusca, primeiro } from "@/lib/busca";
import { REGEX_MES, mesAtualEmPalmas, somarMeses } from "@/lib/financeiro";

/**
 * Filtros da tela Atividades > Concluídas, na URL:
 * - ?mes=AAAA-MM (mês da conclusão em Palmas). Sem o parâmetro = mês atual;
 *   ?mes=tudo = todos os meses ("todos" é o "sem filtro" do useFiltrosUrl,
 *   que apagaria o parâmetro e voltaria ao mês atual).
 * - ?responsavel=<uuid> ou "nenhum" (sem responsável).
 * - ?q= busca no título.
 */
export const TODOS_OS_MESES = "tudo";

export type FiltrosConcluidas = {
  /** "AAAA-MM" ou null (todos os meses). */
  mes: string | null;
  /** "" (todos), uuid ou SEM_RESPONSAVEL. */
  responsavel: string;
  q: string;
};

type Params = Record<string, string | string[] | undefined>;

export function lerFiltrosConcluidas(sp: Params, agora = new Date()): FiltrosConcluidas {
  const mes = primeiro(sp.mes);
  const responsavel = primeiro(sp.responsavel) ?? "";
  return {
    mes: mes === TODOS_OS_MESES ? null : mes && REGEX_MES.test(mes) ? mes : mesAtualEmPalmas(agora),
    responsavel:
      responsavel === SEM_RESPONSAVEL || z.uuid().safeParse(responsavel).success ? responsavel : "",
    q: limparBusca(primeiro(sp.q) ?? "").slice(0, 100),
  };
}

/** Início e fim (exclusivo) do mês no fuso de Palmas (UTC−3, sem horário de verão). */
export function intervaloDoMes(mes: string) {
  return {
    desde: `${mes}-01T00:00:00-03:00`,
    antesDe: `${somarMeses(mes, 1)}-01T00:00:00-03:00`,
  };
}
