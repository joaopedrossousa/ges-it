import { z } from "zod";

import {
  FILTRO_AGUARDANDO_APROVACAO,
  REGEX_MES,
  SITUACAO_PAGAMENTO_LABEL,
  TIPO_DESPESA_LABEL,
  competenciaDoMes,
  formatarCompetenciaCurta,
  formatarMes,
  lerMes,
  mesAtualEmPalmas,
  mesesEntre,
  nomeFinanceiro,
  paraSituacaoVencimento,
  resumirLancamentos,
  rotuloAprovacao,
  rotuloVencimento,
  somarReais,
} from "@/lib/financeiro";
import { limparBusca } from "@/lib/busca";
import {
  AGRUPAMENTOS_EVOLUCAO,
  PERIODOS_EVOLUCAO,
  ehAgrupamentoEvolucao,
  ehPeriodoEvolucao,
  mesesDoPeriodo,
  montarEvolucao,
  tabelaEvolucao,
  textoVariacao,
  type DadosEvolucao,
} from "@/lib/financeiro-evolucao";
import { buscarLancamentosEvolucao } from "@/lib/financeiro-servidor";
import { formatarMoeda } from "@/lib/format";
import { TIPOS_DESPESA, type SituacaoPagamento, type TipoDespesa, type VwLancamentoRow } from "@/lib/types";

import {
  buscarTodas,
  dataSemHora,
  lojaDoParametro,
  nomeDaLoja,
  type Gerador,
  type Supabase,
} from "./comum";
import { ErroRelatorio, type Coluna, type Linha, type Relatorio, type ResumoValores } from "./tipos";

/**
 * Relatórios da Gestão Financeira (migrations 015 e 016). Valores sempre sem
 * os cancelados nos totais. Nomes como "Fornecedor · descrição · identificador".
 */

// ===========================================================================
// Auxiliares
// ===========================================================================

const SELECT =
  "id, competencia, tipo, fornecedor, descricao, servico_identificador, loja_nome, vencimento, valor, situacao, situacao_vencimento, dias_para_vencer, data_pagamento, id_aprovacao, aprovacao_ok, observacao";

type LinhaLancamento = Pick<
  VwLancamentoRow,
  | "id"
  | "competencia"
  | "tipo"
  | "fornecedor"
  | "descricao"
  | "servico_identificador"
  | "loja_nome"
  | "vencimento"
  | "valor"
  | "situacao"
  | "situacao_vencimento"
  | "dias_para_vencer"
  | "data_pagamento"
  | "id_aprovacao"
  | "aprovacao_ok"
  | "observacao"
>;

const tipoSchema = z.enum(TIPOS_DESPESA);

/** ?<chave>=AAAA-MM válido, senão o padrão. */
function mesDoParametro(params: URLSearchParams, chave: string, padrao: string) {
  const v = params.get(chave);
  return v && REGEX_MES.test(v) ? v : padrao;
}

/** ?de e ?ate (AAAA-MM; padrão: o mês atual). */
function periodoDeMeses(params: URLSearchParams, agora: Date) {
  const atual = mesAtualEmPalmas(agora);
  const de = mesDoParametro(params, "de", atual);
  const ate = mesDoParametro(params, "ate", atual);
  if (de > ate) throw new ErroRelatorio(400, "O mês inicial deve ser anterior ou igual ao final.");
  const meses = mesesEntre(de, ate);
  if (meses.length > 60) throw new ErroRelatorio(400, "Escolha um período de até 60 meses.");
  return { de, ate, meses };
}

const textoPeriodo = (de: string, ate: string) =>
  de === ate ? formatarMes(de) : `${formatarMes(de)} a ${formatarMes(ate)}`;

/** Linha comum dos relatórios de lançamentos. `_valor` e `_situacao` só servem às somas. */
function linhaDoLancamento(l: LinhaLancamento): Linha {
  const sv = paraSituacaoVencimento(l.situacao_vencimento);
  return {
    competencia: l.competencia ? formatarCompetenciaCurta(l.competencia) : null,
    mes: l.competencia ? formatarMes(l.competencia) : null,
    tipo: l.tipo ? TIPO_DESPESA_LABEL[l.tipo] : null,
    nome: nomeFinanceiro({
      fornecedor: l.fornecedor,
      descricao: l.descricao,
      identificador: l.servico_identificador,
    }),
    filial: l.loja_nome ?? "Geral",
    vencimento: dataSemHora(l.vencimento),
    valor: l.valor,
    situacao: l.situacao ? SITUACAO_PAGAMENTO_LABEL[l.situacao] : null,
    situacao_vencimento: sv ? rotuloVencimento(sv, l.dias_para_vencer) : null,
    pagamento: dataSemHora(l.data_pagamento),
    id_aprovacao: l.id_aprovacao,
    aprovacao: l.aprovacao_ok === null ? "Não Informada" : rotuloAprovacao(l.aprovacao_ok),
    observacao: l.observacao,
    _id: l.id,
    _valor: l.valor,
    _situacao: l.situacao,
    _tipo: l.tipo,
  };
}

/** Resumo das linhas (cancelados fora), lendo `_valor` e `_situacao`. */
function resumirLinhas(linhas: Linha[]) {
  return resumirLancamentos(
    linhas.map((l) => ({
      valor: typeof l._valor === "number" ? l._valor : 0,
      situacao: (l._situacao as SituacaoPagamento | null) ?? null,
      situacao_vencimento: null,
    })),
  );
}

/** Total, Pago e Em Aberto (cancelados fora). */
const RESUMO_SITUACAO: ResumoValores = {
  coluna: "valor",
  unidade: ["lançamento", "lançamentos"],
  somas: (linhas) => {
    const r = resumirLinhas(linhas);
    return [
      { rotulo: "Total", valor: r.total.valor },
      { rotulo: "Pago", valor: r.pago.valor },
      { rotulo: "Em Aberto", valor: r.aberto.valor },
    ];
  },
};

async function filtrosComuns(supabase: Supabase, params: URLSearchParams) {
  const lojaId = lojaDoParametro(params);
  const tipo = tipoSchema.safeParse(params.get("tipo")).data;
  return {
    lojaId,
    tipo,
    rotulos: [
      tipo && { rotulo: "Tipo", valor: TIPO_DESPESA_LABEL[tipo] },
      lojaId
        ? { rotulo: "Filial", valor: (await nomeDaLoja(supabase, lojaId)) ?? "" }
        : { rotulo: "Filiais", valor: "todas" },
    ].filter((x) => !!x),
  };
}

/** Colunas do lançamento na ordem da planilha (sem as de agrupamento). */
const COL = {
  competencia: { chave: "competencia", titulo: "Competência", peso: 0.7 },
  tipo: { chave: "tipo", titulo: "Tipo", peso: 1 },
  nome: { chave: "nome", titulo: "Fornecedor / Descrição", peso: 2.2 },
  filial: { chave: "filial", titulo: "Filial", peso: 1.1 },
  vencimento: { chave: "vencimento", titulo: "Vencimento", tipo: "data", peso: 0.8 },
  valor: { chave: "valor", titulo: "Valor", tipo: "moeda", peso: 0.9 },
  situacao: { chave: "situacao", titulo: "Situação", peso: 1.1 },
  situacao_vencimento: { chave: "situacao_vencimento", titulo: "Situação do Vencimento", peso: 1.2 },
  pagamento: { chave: "pagamento", titulo: "Data do Pagamento", tipo: "data", peso: 0.9 },
  id_aprovacao: { chave: "id_aprovacao", titulo: "ID da Aprovação", peso: 0.9 },
  aprovacao: { chave: "aprovacao", titulo: "Aprovação", peso: 0.8 },
  observacao: { chave: "observacao", titulo: "Observação", peso: 1.5 },
} satisfies Record<string, Coluna>;

// ===========================================================================
// 1. Controle Mensal (igual à planilha: por tipo, com subtotais)
// ===========================================================================

/** ?mes (AAAA-MM; padrão: mês atual) e ?loja. Cancelados aparecem, fora dos totais. */
const controleMensal: Gerador = async (supabase, params, agora) => {
  const mes = mesDoParametro(params, "mes", mesAtualEmPalmas(agora));
  const { lojaId, rotulos } = await filtrosComuns(supabase, params);

  const dados = await buscarTodas<LinhaLancamento>((a, b) => {
    let q = supabase
      .from("vw_lancamentos")
      .select(SELECT)
      .eq("competencia", competenciaDoMes(mes))
      .order("tipo")
      .order("vencimento")
      .order("fornecedor")
      .order("id")
      .range(a, b);
    if (lojaId) q = q.eq("loja_id", lojaId);
    return q;
  });

  const linhas = dados.map(linhaDoLancamento);
  const r = resumirLancamentos(dados); // dos dados brutos: as linhas não trazem a situação do vencimento

  return {
    slug: `controle-mensal-${mes}`,
    titulo: "Controle Mensal",
    aba: "Controle Mensal",
    orientacao: "paisagem",
    filtros: [
      { rotulo: "Competência", valor: formatarMes(mes) },
      ...rotulos,
      {
        rotulo: "Vencido em Aberto",
        valor: `${r.vencido.quantidade} · ${formatarMoeda(r.vencido.valor)}`,
      },
      { rotulo: "Cancelados", valor: "listados, fora dos totais" },
    ],
    colunas: [
      COL.tipo,
      COL.nome,
      COL.filial,
      COL.vencimento,
      COL.valor,
      COL.situacao,
      COL.situacao_vencimento,
      COL.pagamento,
      COL.id_aprovacao,
      COL.aprovacao,
      COL.observacao,
    ],
    linhas,
    agruparPor: "tipo",
    resumo: RESUMO_SITUACAO,
    vazio: "Nenhum lançamento nesta competência.",
  };
};

// ===========================================================================
// 2. Despesas por Período (por mês, com total por tipo)
// ===========================================================================

/** Total e, em seguida, o valor de cada tipo com gasto (cancelados já ficam fora da consulta). */
const RESUMO_POR_TIPO: ResumoValores = {
  coluna: "valor",
  unidade: ["lançamento", "lançamentos"],
  somas: (linhas) => {
    const porTipo = new Map<TipoDespesa, number>();
    let total = 0;
    for (const l of linhas) {
      const valor = typeof l._valor === "number" ? l._valor : 0;
      total = somarReais(total, valor);
      const tipo = l._tipo as TipoDespesa | null;
      if (tipo) porTipo.set(tipo, somarReais(porTipo.get(tipo) ?? 0, valor));
    }
    return [
      { rotulo: "Total", valor: total },
      ...TIPOS_DESPESA.filter((t) => (porTipo.get(t) ?? 0) > 0).map((t) => ({
        rotulo: TIPO_DESPESA_LABEL[t],
        valor: porTipo.get(t) ?? 0,
      })),
    ];
  },
};

/** ?de e ?ate (AAAA-MM), ?tipo, ?loja e ?fornecedor (parte do nome). Sem os cancelados. */
const despesasPeriodo: Gerador = async (supabase, params, agora) => {
  const { de, ate } = periodoDeMeses(params, agora);
  const { lojaId, tipo, rotulos } = await filtrosComuns(supabase, params);
  const fornecedor = limparBusca(params.get("fornecedor") ?? "").slice(0, 100);

  const dados = await buscarTodas<LinhaLancamento>((a, b) => {
    let q = supabase
      .from("vw_lancamentos")
      .select(SELECT)
      .gte("competencia", competenciaDoMes(de))
      .lte("competencia", competenciaDoMes(ate))
      .neq("situacao", "cancelado")
      .order("competencia")
      .order("tipo")
      .order("vencimento")
      .order("fornecedor")
      .order("id")
      .range(a, b);
    if (tipo) q = q.eq("tipo", tipo);
    if (lojaId) q = q.eq("loja_id", lojaId);
    if (fornecedor) q = q.ilike("fornecedor", `%${fornecedor}%`);
    return q;
  });

  return {
    slug: `despesas-${de}-a-${ate}`,
    titulo: "Despesas por Período",
    aba: "Despesas",
    orientacao: "paisagem",
    filtros: [
      { rotulo: "Período", valor: textoPeriodo(de, ate) },
      ...rotulos,
      fornecedor && { rotulo: "Fornecedor", valor: `contém "${fornecedor}"` },
      { rotulo: "Cancelados", valor: "fora do relatório" },
    ].filter((x) => !!x),
    colunas: [
      { chave: "mes", titulo: "Mês", peso: 1 },
      COL.tipo,
      COL.nome,
      COL.filial,
      COL.vencimento,
      COL.valor,
      COL.situacao,
      COL.pagamento,
      COL.id_aprovacao,
    ],
    linhas: dados.map(linhaDoLancamento),
    agruparPor: "mes",
    resumo: RESUMO_POR_TIPO,
    vazio: "Nenhuma despesa no período com esses filtros.",
  };
};

// ===========================================================================
// 3. Despesas por Fornecedor (soma, média mensal e quantidade)
// ===========================================================================

/** ?de e ?ate (AAAA-MM) e ?tipo. Fornecedores iguais sem diferença de maiúsculas/espaços. */
const despesasFornecedor: Gerador = async (supabase, params, agora) => {
  const { de, ate, meses } = periodoDeMeses(params, agora);
  const tipo = tipoSchema.safeParse(params.get("tipo")).data;

  const dados = await buscarTodas((a, b) => {
    let q = supabase
      .from("vw_lancamentos")
      .select("id, fornecedor, tipo, valor, situacao")
      .gte("competencia", competenciaDoMes(de))
      .lte("competencia", competenciaDoMes(ate))
      .neq("situacao", "cancelado")
      .order("id")
      .range(a, b);
    if (tipo) q = q.eq("tipo", tipo);
    return q;
  });

  type Soma = {
    fornecedor: string;
    tipos: Set<TipoDespesa>;
    quantidade: number;
    total: number;
    pago: number;
  };
  const porFornecedor = new Map<string, Soma>();
  for (const l of dados) {
    const nome = (l.fornecedor ?? "").trim() || "Sem fornecedor";
    const chave = nome.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
    const s = porFornecedor.get(chave) ?? {
      fornecedor: nome,
      tipos: new Set<TipoDespesa>(),
      quantidade: 0,
      total: 0,
      pago: 0,
    };
    if (l.tipo) s.tipos.add(l.tipo);
    s.quantidade += 1;
    s.total = somarReais(s.total, l.valor ?? 0);
    if (l.situacao === "pago") s.pago = somarReais(s.pago, l.valor ?? 0);
    porFornecedor.set(chave, s);
  }

  const n = meses.length;
  const linhas: Linha[] = [...porFornecedor.values()]
    .sort((a, b) => b.total - a.total || a.fornecedor.localeCompare(b.fornecedor, "pt-BR"))
    .map((s) => ({
      fornecedor: s.fornecedor,
      tipos: TIPOS_DESPESA.filter((t) => s.tipos.has(t))
        .map((t) => TIPO_DESPESA_LABEL[t])
        .join(", "),
      quantidade: s.quantidade,
      total: s.total,
      media: Math.round((s.total / n) * 100) / 100,
      pago: s.pago,
      aberto: somarReais(s.total, -s.pago),
    }));

  const soma = (chave: string) => (ls: Linha[]) =>
    ls.reduce<number>((t, l) => {
      const v = l[chave];
      return somarReais(t, typeof v === "number" ? v : 0);
    }, 0);

  return {
    slug: `despesas-por-fornecedor-${de}-a-${ate}`,
    titulo: "Despesas por Fornecedor",
    aba: "Por Fornecedor",
    orientacao: "paisagem",
    filtros: [
      { rotulo: "Período", valor: textoPeriodo(de, ate) },
      tipo && { rotulo: "Tipo", valor: TIPO_DESPESA_LABEL[tipo] },
      { rotulo: "Média Mensal", valor: `total ÷ ${n} ${n === 1 ? "mês" : "meses"} do período` },
      { rotulo: "Cancelados", valor: "fora do relatório" },
    ].filter((x) => !!x),
    colunas: [
      { chave: "fornecedor", titulo: "Fornecedor", peso: 2 },
      { chave: "tipos", titulo: "Tipos", peso: 1.6 },
      { chave: "quantidade", titulo: "Lançamentos", tipo: "numero", peso: 0.8 },
      { chave: "total", titulo: "Total", tipo: "moeda", peso: 1 },
      { chave: "media", titulo: "Média Mensal", tipo: "moeda", peso: 1 },
      { chave: "pago", titulo: "Pago", tipo: "moeda", peso: 1 },
      { chave: "aberto", titulo: "Em Aberto", tipo: "moeda", peso: 1 },
    ],
    linhas,
    resumo: {
      coluna: "total",
      unidade: ["fornecedor", "fornecedores"],
      somas: (ls) => [
        { rotulo: "Total", valor: soma("total")(ls) },
        { rotulo: "Média Mensal", valor: soma("media")(ls) },
        { rotulo: "Pago", valor: soma("pago")(ls) },
        { rotulo: "Em Aberto", valor: soma("aberto")(ls) },
      ],
    },
    vazio: "Nenhuma despesa no período com esses filtros.",
  };
};

// ===========================================================================
// 4. Pendências (vencidos em aberto e aguardando aprovação)
// ===========================================================================

/**
 * ?loja e ?tipo; de qualquer competência. Um lançamento vencido e sem
 * aprovação aparece nos dois grupos.
 */
const pendencias: Gerador = async (supabase, params) => {
  const { lojaId, tipo, rotulos } = await filtrosComuns(supabase, params);

  const consulta = (filtrar: (q: ReturnType<typeof base>) => ReturnType<typeof base>) =>
    buscarTodas<LinhaLancamento>((a, b) => filtrar(base()).range(a, b));
  function base() {
    let q = supabase
      .from("vw_lancamentos")
      .select(SELECT)
      .neq("situacao", "cancelado")
      .order("vencimento")
      .order("fornecedor")
      .order("id");
    if (lojaId) q = q.eq("loja_id", lojaId);
    if (tipo) q = q.eq("tipo", tipo);
    return q;
  }

  const [vencidos, aguardando] = await Promise.all([
    consulta((q) => q.eq("situacao_vencimento", "vencido")),
    consulta((q) => q.or(FILTRO_AGUARDANDO_APROVACAO)),
  ]);

  const linhas: Linha[] = [
    ...vencidos.map((l) => ({ ...linhaDoLancamento(l), pendencia: "Vencidos em Aberto" })),
    ...aguardando.map((l) => ({ ...linhaDoLancamento(l), pendencia: "Aguardando Aprovação" })),
  ];

  return {
    slug: "pendencias-financeiras",
    titulo: "Pendências Financeiras",
    aba: "Pendências",
    orientacao: "paisagem",
    filtros: [
      ...rotulos,
      { rotulo: "Vencidos em Aberto", valor: `${vencidos.length}` },
      { rotulo: "Aguardando Aprovação", valor: `${aguardando.length} (Não OK, ou sem aprovação em Solicitado Compras)` },
    ],
    colunas: [
      { chave: "pendencia", titulo: "Pendência", peso: 1.2 },
      COL.competencia,
      COL.tipo,
      COL.nome,
      COL.filial,
      COL.vencimento,
      COL.situacao_vencimento,
      COL.valor,
      COL.situacao,
      COL.id_aprovacao,
      COL.aprovacao,
    ],
    linhas,
    agruparPor: "pendencia",
    resumo: {
      coluna: "valor",
      unidade: ["lançamento", "lançamentos"],
      // No total geral, quem está nos dois grupos conta uma vez só.
      somas: (ls) => {
        const unicos = [...new Map(ls.map((l) => [l._id, l])).values()];
        return [{ rotulo: "Total", valor: resumirLinhas(unicos).total.valor }];
      },
    },
    vazio: "Nenhuma pendência: nada vencido em aberto nem aguardando aprovação.",
  };
};

// ===========================================================================
// Evolução Mensal por Fornecedor (tabela do Painel)
// ===========================================================================

/** O PDF tem uma coluna por mês: acima disso as células não cabem na página. */
const MAX_MESES_PDF = 12;

/**
 * Mesmos dados e regra da tabela "Evolução Mensal por Fornecedor" do Painel
 * (cancelados fora): ?mes (fim do período), ?periodo (6m, 12m, ano, tudo)
 * e ?agrupamento (fornecedor ou servico).
 */
const evolucaoFornecedor: Gerador = async (_supabase, params) =>
  relatorioEvolucao(montarEvolucao(await buscarLancamentosEvolucao()), params);

/** Monta o relatório a partir dos dados já agrupados (puro). */
export function relatorioEvolucao(dados: DadosEvolucao, params: URLSearchParams): Relatorio {
  const mes = lerMes(params.get("mes"));
  const p = params.get("periodo");
  const periodo = ehPeriodoEvolucao(p) ? p : "12m";
  const a = params.get("agrupamento");
  const agrupamento = ehAgrupamentoEvolucao(a) ? a : "fornecedor";

  const meses = mesesDoPeriodo(periodo, mes, dados);
  if (params.get("formato") === "pdf" && meses.length > MAX_MESES_PDF) {
    throw new ErroRelatorio(
      422,
      `O PDF aceita até ${MAX_MESES_PDF} meses e este período tem ${meses.length}. Escolha um período menor ou exporte em Excel.`,
    );
  }
  const t = tabelaEvolucao(dados[agrupamento], meses);
  const rotuloMes = (m: string) => {
    const [ano, mm] = m.split("-");
    const nome = new Date(Number(ano), Number(mm) - 1, 15)
      .toLocaleDateString("pt-BR", { month: "short" })
      .replace(".", "");
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${ano.slice(2)}`;
  };

  const colunas: Coluna[] = [
    { chave: "nome", titulo: agrupamento === "fornecedor" ? "Fornecedor" : "Serviço", peso: 2.4 },
    ...meses.map((m, i): Coluna => ({ chave: `m${i}`, titulo: rotuloMes(m), tipo: "moeda", peso: 1 })),
    { chave: "total", titulo: "Total", tipo: "moeda", peso: 1.1 },
    { chave: "media", titulo: "Média Mensal", tipo: "moeda", peso: 1.1 },
    { chave: "variacao", titulo: "Variação", peso: 0.8 },
  ];
  // No PDF, os valores vão sem o "R$" (chaves p*), senão 12 meses não cabem
  // na largura da página; o Excel recebe os números (moeda).
  const reais = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const linha = (nome: string, valores: number[], total: number, media: number, variacao: string): Linha => ({
    nome,
    ...Object.fromEntries(valores.flatMap((v, i) => [[`m${i}`, v], [`p${i}`, reais(v)]])),
    total,
    media,
    p_total: reais(total),
    p_media: reais(media),
    variacao,
  });
  const linhas = t.linhas.map((l) => linha(l.serie.nome, l.valores, l.total, l.media, textoVariacao(l)));
  const colunasPdf: Coluna[] = [
    { chave: "nome", titulo: colunas[0].titulo, peso: 2.6 },
    ...meses.map((m, i): Coluna => ({ chave: `p${i}`, titulo: rotuloMes(m), peso: 1 })),
    { chave: "p_total", titulo: "Total", peso: 1.15 },
    { chave: "p_media", titulo: "Média", peso: 1 },
    { chave: "variacao", titulo: "Variação", peso: 0.85 },
  ];

  return {
    slug: `evolucao-por-${agrupamento}`,
    titulo: `Evolução Mensal por ${agrupamento === "fornecedor" ? "Fornecedor" : "Serviço"}`,
    aba: "Evolução",
    orientacao: "paisagem",
    filtros: [
      {
        rotulo: "Período",
        valor: `${PERIODOS_EVOLUCAO.find((x) => x.valor === periodo)?.rotulo ?? periodo} (${meses.length > 0 ? `${formatarCompetenciaCurta(`${meses[0]}-01`)} a ${formatarCompetenciaCurta(`${meses[meses.length - 1]}-01`)}` : "—"})`,
      },
      { rotulo: "Agrupamento", valor: AGRUPAMENTOS_EVOLUCAO.find((x) => x.valor === agrupamento)?.rotulo ?? agrupamento },
      { rotulo: "Regra", valor: "Valor por competência, cancelados fora (igual à Evolução Mensal)" },
      { rotulo: "Total do período", valor: formatarMoeda(t.totalGeral) },
      ...(params.get("formato") === "pdf" ? [{ rotulo: "Valores", valor: "Em reais (R$)" }] : []),
    ],
    colunas,
    colunasPdf,
    linhas,
    linhaTotal: linha("Total Geral", t.totais, t.totalGeral, t.mediaGeral, textoVariacao(t.variacaoGeral)),
    vazio: "Nenhum lançamento no período.",
  };
}

export const GERADORES_FINANCEIRO = {
  "financeiro-controle-mensal": controleMensal,
  "financeiro-despesas-periodo": despesasPeriodo,
  "financeiro-despesas-fornecedor": despesasFornecedor,
  "financeiro-pendencias": pendencias,
  "financeiro-evolucao-fornecedor": evolucaoFornecedor,
} satisfies Record<string, Gerador>;
