import { cache } from "react";

import { competenciaDoMes } from "@/lib/financeiro";
import { SELECT_EVOLUCAO, type LinhaEvolucao } from "@/lib/financeiro-evolucao";
import type { FiltrosLancamentos } from "@/lib/filtros-financeiro";
import { createClient } from "@/lib/supabase/server";
import type { TipoDespesa, VwLancamentoRow } from "@/lib/types";

/** Serviço do catálogo para o formulário de lançamento. */
export type ServicoFinanceiroOpcao = {
  id: string;
  tipo: TipoDespesa;
  fornecedor: string;
  descricao: string | null;
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
      .order("fornecedor")
      .order("descricao", { nullsFirst: true })
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
 * vencimento, fornecedor, descrição.
 */
export async function buscarLancamentosDoMes(f: FiltrosLancamentos) {
  const supabase = await createClient();
  let q = supabase
    .from("vw_lancamentos")
    .select("*")
    .eq("competencia", competenciaDoMes(f.mes))
    .order("tipo")
    .order("vencimento")
    .order("fornecedor")
    .order("descricao", { nullsFirst: true })
    .order("id")
    .range(0, LIMITE_LANCAMENTOS_MES - 1);

  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.situacao) q = q.eq("situacao", f.situacao);
  if (f.vencimento) q = q.eq("situacao_vencimento", f.vencimento);
  if (f.lojaId) q = q.eq("loja_id", f.lojaId);
  // Vindos do Painel (Evolução por Fornecedor): fornecedor exato (sem
  // diferenciar maiúsculas) e serviço do catálogo ("avulso" = sem serviço).
  if (f.fornecedor) q = q.ilike("fornecedor", escaparLike(f.fornecedor));
  if (f.servico === "avulso") q = q.is("servico_id", null);
  else if (f.servico) q = q.eq("servico_id", f.servico);
  if (f.busca) {
    q = q.or(
      [
        `fornecedor.ilike.%${f.busca}%`,
        `descricao.ilike.%${f.busca}%`,
        `servico_identificador.ilike.%${f.busca}%`,
        `id_aprovacao.ilike.%${f.busca}%`,
      ].join(","),
    );
  }
  return q;
}

/** Texto literal no ilike (sem curingas % e _). */
function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, (c) => "\\" + c);
}

/** Máximo de linhas por resposta do PostgREST (max-rows padrão do Supabase). */
const LOTE = 1000;
/** Teto de segurança do Painel (12 meses têm poucas centenas de lançamentos). */
const LIMITE_PAINEL = 20_000;

export const SELECT_GASTOS =
  "id, competencia, tipo, loja_id, valor, situacao, situacao_vencimento, aprovacao_ok";

/**
 * Lançamentos de `deMes` a `ateMes` ("AAAA-MM"), com os campos dos totais e
 * gráficos, em lotes (ordenação estável terminando em id).
 */
export const buscarGastosPeriodo = cache(async (deMes: string, ateMes: string) => {
  const supabase = await createClient();
  const linhas = [];
  for (let de = 0; de < LIMITE_PAINEL; de += LOTE) {
    const { data, error } = await supabase
      .from("vw_lancamentos")
      .select(SELECT_GASTOS)
      .gte("competencia", competenciaDoMes(deMes))
      .lte("competencia", competenciaDoMes(ateMes))
      .order("competencia")
      .order("id")
      .range(de, de + LOTE - 1);
    if (error) throw new Error(error.message);
    linhas.push(...data);
    if (data.length < LOTE) break;
  }
  return linhas;
});

/**
 * Todos os lançamentos, com os campos da Evolução por Fornecedor (o período
 * e o agrupamento são escolhidos na tela). Em lotes, ordenação estável.
 */
export const buscarLancamentosEvolucao = cache(async (): Promise<LinhaEvolucao[]> => {
  const supabase = await createClient();
  const linhas: LinhaEvolucao[] = [];
  for (let de = 0; de < LIMITE_PAINEL; de += LOTE) {
    const { data, error } = await supabase
      .from("vw_lancamentos")
      .select(SELECT_EVOLUCAO)
      .neq("situacao", "cancelado")
      .order("competencia")
      .order("id")
      .range(de, de + LOTE - 1);
    if (error) throw new Error(error.message);
    linhas.push(...data);
    if (data.length < LOTE) break;
  }
  return linhas;
});

/** Campos das listas do Painel (vencimentos). */
export const SELECT_LISTA =
  "id, competencia, fornecedor, descricao, servico_identificador, loja_nome, vencimento, valor, situacao_vencimento, dias_para_vencer";

/**
 * Em aberto, de qualquer mês, por situação do vencimento, do vencimento
 * mais antigo para o mais novo (em "hoje" + "proximo", hoje vem primeiro).
 */
export async function buscarVencimentos(situacoes: string[], limite: number) {
  const supabase = await createClient();
  return supabase
    .from("vw_lancamentos")
    .select(SELECT_LISTA, { count: "exact" })
    .in("situacao_vencimento", situacoes)
    .order("vencimento")
    .order("fornecedor")
    .order("id")
    .limit(limite);
}
