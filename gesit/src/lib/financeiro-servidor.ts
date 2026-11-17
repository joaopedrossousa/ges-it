import { cache } from "react";

import { competenciaDoMes } from "@/lib/financeiro";
import type { FiltrosLancamentos } from "@/lib/filtros-financeiro";
import { createClient } from "@/lib/supabase/server";
import type { TipoDespesa, VwLancamentoRow } from "@/lib/types";

/** Serviço do catálogo para o formulário de lançamento. */
export type ServicoFinanceiroOpcao = {
  id: string;
  tipo: TipoDespesa;
  descricao: string;
  fornecedor: string | null;
  identificador: string | null;
  loja_id: string | null;
  dia_vencimento: number | null;
  valor_referencia: number | null;
  ativo: boolean;
};

/** Catálogo completo (ativos primeiro). `cache`: uma consulta por requisição. */
export const listarServicosFinanceirosOpcoes = cache(
  async (): Promise<ServicoFinanceiroOpcao[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("servicos_financeiros")
      .select(
        "id, tipo, descricao, fornecedor, identificador, loja_id, dia_vencimento, valor_referencia, ativo",
      )
      .order("ativo", { ascending: false })
      .order("tipo")
      .order("descricao")
      .order("id");
    if (error) {
      console.error("Erro ao listar serviços financeiros:", error);
      return [];
    }
    return data;
  },
);

export type LancamentoLinha = VwLancamentoRow;

/** Um mês tem poucas dezenas de lançamentos; o teto só protege a tela. */
export const LIMITE_LANCAMENTOS_MES = 1000;

/**
 * Lançamentos da competência com os filtros, na ordem da planilha: tipo,
 * vencimento, descrição.
 */
export async function buscarLancamentosDoMes(f: FiltrosLancamentos) {
  const supabase = await createClient();
  let q = supabase
    .from("vw_lancamentos")
    .select("*")
    .eq("competencia", competenciaDoMes(f.mes))
    .order("tipo")
    .order("vencimento")
    .order("descricao")
    .order("id")
    .range(0, LIMITE_LANCAMENTOS_MES - 1);

  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.situacao) q = q.eq("situacao", f.situacao);
  if (f.vencimento) q = q.eq("situacao_vencimento", f.vencimento);
  if (f.lojaId) q = q.eq("loja_id", f.lojaId);
  if (f.busca) {
    q = q.or(
      [
        `descricao.ilike.%${f.busca}%`,
        `servico_identificador.ilike.%${f.busca}%`,
        `id_aprovacao.ilike.%${f.busca}%`,
      ].join(","),
    );
  }
  return q;
}
