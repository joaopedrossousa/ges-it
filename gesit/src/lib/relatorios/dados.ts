import { z } from "zod";

import { descricaoDispositivo, identificadorDispositivo } from "@/lib/dispositivos";
import {
  filtroBuscaDispositivos,
  lerFiltrosDispositivos,
} from "@/lib/filtros-dispositivos";
import {
  formatarData,
  formatarDuracao,
  formatarIdadeMeses,
  hojeEmPalmas,
} from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";
import {
  SITUACAO_VIDA_UTIL_LABEL,
  STATUS_DISPOSITIVO_LABEL,
  TIPOS_DISPOSITIVO,
  TIPO_DISPOSITIVO_LABEL,
  paraSituacaoVidaUtil,
} from "@/lib/types";
import { mascararCPF } from "@/lib/validators";

import {
  ErroRelatorio,
  LIMITE_LINHAS,
  MSG_LIMITE,
  type Linha,
  type Relatorio,
  type TipoRelatorio,
} from "./tipos";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Gerador = (supabase: Supabase, params: URLSearchParams, agora: Date) => Promise<Relatorio>;

// ===========================================================================
// Auxiliares
// ===========================================================================

/** Máximo de linhas por resposta do PostgREST no Supabase (max-rows padrão). */
const LOTE = 1000;

type Resposta<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Busca em lotes até LIMITE_LINHAS (+1 para saber se passou do limite).
 * `consulta` precisa de ordenação estável (ex.: terminar em .order("id")).
 */
async function buscarTodas<T>(
  consulta: (de: number, ate: number) => PromiseLike<Resposta<T>>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; de <= LIMITE_LINHAS; de += LOTE) {
    const { data, error } = await consulta(de, de + LOTE - 1);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < LOTE) break;
  }
  if (linhas.length > LIMITE_LINHAS) throw new ErroRelatorio(422, MSG_LIMITE);
  return linhas;
}

async function nomeDaLoja(supabase: Supabase, id: string | undefined) {
  if (!id) return null;
  const { data } = await supabase.from("lojas").select("nome").eq("id", id).maybeSingle();
  return data?.nome ?? "Loja não encontrada";
}

function idObrigatorio(params: URLSearchParams, mensagem: string) {
  const id = params.get("id");
  if (!z.uuid().safeParse(id).success || !id) throw new ErroRelatorio(400, mensagem);
  return id;
}

function lojaDoParametro(params: URLSearchParams) {
  const loja = params.get("loja");
  return z.uuid().safeParse(loja).success && loja ? loja : undefined;
}

const sim = (v: unknown) => (v ? "Sim" : "Não");

/**
 * Data sem hora do banco ("AAAA-MM-DD") como instante ao meio-dia de Palmas:
 * o PDF e o Excel exibem no fuso de Palmas, e meia-noite UTC viraria o dia anterior.
 */
const dataSemHora = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00-03:00`) : null);

// ===========================================================================
// 1. Inventário de dispositivos (mesmos filtros de /dispositivos)
// ===========================================================================

const inventario: Gerador = async (supabase, params) => {
  const f = lerFiltrosDispositivos(params);
  const filtroBusca = filtroBuscaDispositivos(f.busca);

  const dados = await buscarTodas((de, ate) => {
    let q = supabase
      .from("vw_dispositivos")
      .select(
        "id, tipo, marca, modelo, serial_number, imei1, numero_patrimonio, status, colaborador_nome, loja_nome, vinculado_em, data_compra, idade_meses, fim_vida_util, situacao_vida_util",
      )
      .order("tipo")
      .order("marca")
      .order("modelo")
      .order("id")
      .range(de, ate);
    if (f.tipo) q = q.eq("tipo", f.tipo);
    if (f.status) q = q.eq("status", f.status);
    if (f.lojaId) q = q.eq("loja_id", f.lojaId);
    if (f.vidaUtil) q = q.eq("situacao_vida_util", f.vidaUtil);
    if (filtroBusca) q = q.or(filtroBusca);
    return q;
  });

  const filtros = [
    f.busca && { rotulo: "Busca", valor: `"${f.busca}"` },
    f.tipo && { rotulo: "Tipo", valor: TIPO_DISPOSITIVO_LABEL[f.tipo] },
    f.status && { rotulo: "Status", valor: STATUS_DISPOSITIVO_LABEL[f.status] },
    f.lojaId && { rotulo: "Loja", valor: (await nomeDaLoja(supabase, f.lojaId)) ?? "" },
    f.vidaUtil && { rotulo: "Vida útil", valor: SITUACAO_VIDA_UTIL_LABEL[f.vidaUtil] },
  ].filter((x) => !!x);

  return {
    slug: "inventario",
    titulo: "Inventário de dispositivos",
    aba: "Inventário",
    orientacao: "paisagem",
    filtros: filtros.length ? filtros : [{ rotulo: "Filtros", valor: "nenhum (todos os dispositivos)" }],
    colunas: [
      { chave: "tipo", titulo: "Tipo", peso: 0.7 },
      { chave: "marca", titulo: "Marca", peso: 0.8 },
      { chave: "modelo", titulo: "Modelo", peso: 1.2 },
      { chave: "identificador", titulo: "Identificador", peso: 1.3 },
      { chave: "patrimonio", titulo: "Patrimônio", peso: 0.8 },
      { chave: "status", titulo: "Status", peso: 0.8 },
      { chave: "usuario", titulo: "Usuário atual", peso: 1.3 },
      { chave: "loja", titulo: "Loja", peso: 1 },
      { chave: "desde", titulo: "Desde", tipo: "data", peso: 0.75 },
      { chave: "compra", titulo: "Compra", tipo: "data", peso: 0.75 },
      { chave: "idade", titulo: "Idade", peso: 1.05 },
      { chave: "fim_vida_util", titulo: "Fim vida útil", tipo: "data", peso: 0.8 },
      { chave: "vida_util", titulo: "Vida útil", peso: 0.95 },
    ],
    // PDF mais enxuto; as datas e a idade ficam só no Excel.
    colunasPdf: [
      { chave: "tipo", titulo: "Tipo", peso: 0.7 },
      { chave: "marca_modelo", titulo: "Marca/Modelo", peso: 1.8 },
      { chave: "identificador", titulo: "Identificador", peso: 1.3 },
      { chave: "patrimonio", titulo: "Patrimônio", peso: 0.9 },
      { chave: "status", titulo: "Status", peso: 0.8 },
      { chave: "usuario", titulo: "Usuário atual", peso: 1.5 },
      { chave: "loja", titulo: "Loja", peso: 1.1 },
      { chave: "vida_util", titulo: "Vida útil", peso: 0.95 },
    ],
    linhas: dados.map((d) => {
      const situacao = paraSituacaoVidaUtil(d.situacao_vida_util);
      return {
        tipo: d.tipo ? TIPO_DISPOSITIVO_LABEL[d.tipo] : null,
        marca: d.marca,
        modelo: d.modelo,
        marca_modelo: [d.marca, d.modelo].filter(Boolean).join(" ") || null,
        identificador: identificadorDispositivo(d),
        patrimonio: d.numero_patrimonio,
        status: d.status ? STATUS_DISPOSITIVO_LABEL[d.status] : null,
        usuario: d.colaborador_nome,
        loja: d.loja_nome,
        desde: d.vinculado_em ? new Date(d.vinculado_em) : null,
        compra: dataSemHora(d.data_compra),
        idade: d.idade_meses !== null ? formatarIdadeMeses(d.idade_meses) : null,
        fim_vida_util: dataSemHora(d.fim_vida_util),
        // Baixados ficam fora dos alertas: o status já diz "Baixado".
        vida_util: situacao && situacao !== "baixado" ? SITUACAO_VIDA_UTIL_LABEL[situacao] : null,
      };
    }),
    vazio: "Nenhum dispositivo encontrado com esses filtros.",
  };
};

// ===========================================================================
// 2. Dispositivos por loja (vínculos abertos, subtotal por loja)
// ===========================================================================

const tipoSchema = z.enum(TIPOS_DISPOSITIVO);

const dispositivosPorLoja: Gerador = async (supabase, params) => {
  const lojaId = lojaDoParametro(params);
  const tipo = tipoSchema.safeParse(params.get("tipo")).data;

  const dados = await buscarTodas((de, ate) => {
    let q = supabase
      .from("vinculos")
      .select(
        "id, data_inicio, termo_path, loja:lojas(nome), colaborador:colaboradores(nome, cargo), dispositivo:dispositivos!inner(tipo, marca, modelo, serial_number, imei1, numero_patrimonio)",
      )
      .is("data_fim", null)
      .order("data_inicio")
      .order("id")
      .range(de, ate);
    if (lojaId) q = q.eq("loja_id", lojaId);
    if (tipo) q = q.eq("dispositivo.tipo", tipo);
    return q;
  });

  const linhas: Linha[] = dados
    .map((v) => ({
      loja: v.loja?.nome ?? "—",
      tipo: TIPO_DISPOSITIVO_LABEL[v.dispositivo.tipo],
      marca: v.dispositivo.marca,
      modelo: v.dispositivo.modelo,
      identificador: identificadorDispositivo(v.dispositivo),
      patrimonio: v.dispositivo.numero_patrimonio,
      usuario: v.colaborador?.nome ?? null,
      cargo: v.colaborador?.cargo ?? null,
      desde: new Date(v.data_inicio),
      termo: sim(v.termo_path),
    }))
    // Por loja (nome); dentro da loja, mantém a ordem por data de início.
    .sort((a, b) => a.loja.localeCompare(b.loja, "pt-BR"));

  const filtros = [
    lojaId && { rotulo: "Loja", valor: (await nomeDaLoja(supabase, lojaId)) ?? "" },
    tipo && { rotulo: "Tipo", valor: TIPO_DISPOSITIVO_LABEL[tipo] },
  ].filter((x) => !!x);

  return {
    slug: "dispositivos-por-loja",
    titulo: "Dispositivos por loja",
    aba: "Por loja",
    orientacao: "paisagem",
    filtros: [
      { rotulo: "Vínculos", valor: "em aberto" },
      ...(filtros.length ? filtros : [{ rotulo: "Lojas", valor: "todas" }]),
    ],
    colunas: [
      { chave: "loja", titulo: "Loja", peso: 1.2 },
      { chave: "tipo", titulo: "Tipo", peso: 0.8 },
      { chave: "marca", titulo: "Marca" },
      { chave: "modelo", titulo: "Modelo", peso: 1.3 },
      { chave: "identificador", titulo: "Identificador", peso: 1.4 },
      { chave: "patrimonio", titulo: "Patrimônio", peso: 0.9 },
      { chave: "usuario", titulo: "Usuário", peso: 1.5 },
      { chave: "cargo", titulo: "Cargo", peso: 1.1 },
      { chave: "desde", titulo: "Desde", tipo: "data", peso: 0.8 },
      { chave: "termo", titulo: "Termo", peso: 0.6 },
    ],
    linhas,
    agruparPor: "loja",
    vazio: "Nenhum dispositivo vinculado com esses filtros.",
  };
};

// ===========================================================================
// 3 e 4. Históricos (dispositivo e usuário)
// ===========================================================================

const COLUNAS_PERIODO = [
  { chave: "loja", titulo: "Loja do vínculo", peso: 1.1 },
  { chave: "inicio", titulo: "Início", tipo: "dataHora", peso: 1 },
  { chave: "fim", titulo: "Fim", tipo: "dataHora", peso: 1 },
  { chave: "duracao", titulo: "Duração", peso: 1.1 },
  { chave: "termo", titulo: "Termo", peso: 0.5 },
  { chave: "observacao", titulo: "Observação", peso: 1.5 },
  { chave: "observacao_devolucao", titulo: "Obs. devolução", peso: 1.5 },
] as const;

type VinculoHistorico = {
  data_inicio: string;
  data_fim: string | null;
  termo_path: string | null;
  observacao: string | null;
  observacao_devolucao: string | null;
  loja: { nome: string } | null;
};

function camposPeriodo(v: VinculoHistorico, agora: Date): Linha {
  return {
    loja: v.loja?.nome ?? null,
    inicio: new Date(v.data_inicio),
    fim: v.data_fim ? new Date(v.data_fim) : null,
    duracao:
      formatarDuracao(v.data_inicio, v.data_fim ? new Date(v.data_fim) : agora) +
      (v.data_fim ? "" : " (em uso)"),
    termo: sim(v.termo_path),
    observacao: v.observacao,
    observacao_devolucao: v.observacao_devolucao,
  };
}

const SELECT_HISTORICO =
  "id, data_inicio, data_fim, termo_path, observacao, observacao_devolucao, loja:lojas(nome)";

const historicoDispositivo: Gerador = async (supabase, params, agora) => {
  const id = idObrigatorio(params, "Dispositivo inválido.");

  const { data: d, error } = await supabase
    .from("dispositivos")
    .select("tipo, marca, modelo, serial_number, imei1, numero_patrimonio, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!d) throw new ErroRelatorio(404, "Dispositivo não encontrado.");

  const vinculos = await buscarTodas((de, ate) =>
    supabase
      .from("vinculos")
      .select(`${SELECT_HISTORICO}, colaborador:colaboradores(nome)`)
      .eq("dispositivo_id", id)
      .order("data_inicio", { ascending: false })
      .order("id")
      .range(de, ate),
  );

  return {
    slug: "historico-dispositivo",
    titulo: "Histórico do dispositivo",
    aba: "Histórico",
    orientacao: "paisagem",
    filtros: [
      { rotulo: "Dispositivo", valor: descricaoDispositivo(d) },
      { rotulo: "Tipo", valor: TIPO_DISPOSITIVO_LABEL[d.tipo] },
      ...(d.numero_patrimonio ? [{ rotulo: "Patrimônio", valor: d.numero_patrimonio }] : []),
      { rotulo: "Status atual", valor: STATUS_DISPOSITIVO_LABEL[d.status] },
    ],
    colunas: [{ chave: "usuario", titulo: "Usuário", peso: 1.5 }, ...COLUNAS_PERIODO],
    linhas: vinculos.map((v) => ({
      usuario: v.colaborador?.nome ?? null,
      ...camposPeriodo(v, agora),
    })),
    vazio: "Este dispositivo ainda não teve vínculos.",
  };
};

const historicoUsuario: Gerador = async (supabase, params, agora) => {
  const id = idObrigatorio(params, "Usuário inválido.");

  const { data: c, error } = await supabase
    .from("colaboradores")
    .select("nome, cargo, cpf, email, ativo, loja:lojas(nome)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new ErroRelatorio(404, "Usuário não encontrado.");

  const vinculos = await buscarTodas((de, ate) =>
    supabase
      .from("vinculos")
      .select(
        `${SELECT_HISTORICO}, dispositivo:dispositivos(tipo, marca, modelo, serial_number, imei1, numero_patrimonio)`,
      )
      .eq("colaborador_id", id)
      .order("data_inicio", { ascending: false })
      .order("id")
      .range(de, ate),
  );

  return {
    slug: "historico-usuario",
    titulo: "Histórico do usuário",
    aba: "Histórico",
    orientacao: "paisagem",
    filtros: [
      { rotulo: "Usuário", valor: c.ativo ? c.nome : `${c.nome} (inativo)` },
      ...(c.cargo ? [{ rotulo: "Cargo", valor: c.cargo }] : []),
      // CPF sempre mascarado nos relatórios.
      { rotulo: "CPF", valor: mascararCPF(c.cpf) },
      { rotulo: "E-mail", valor: c.email },
      { rotulo: "Loja", valor: c.loja?.nome ?? "—" },
    ],
    colunas: [
      { chave: "dispositivo", titulo: "Dispositivo", peso: 1.4 },
      { chave: "identificador", titulo: "Identificador", peso: 1.3 },
      ...COLUNAS_PERIODO,
    ],
    linhas: vinculos.map((v) => ({
      dispositivo: v.dispositivo ? `${v.dispositivo.marca} ${v.dispositivo.modelo}` : null,
      identificador: v.dispositivo ? identificadorDispositivo(v.dispositivo) : null,
      ...camposPeriodo(v, agora),
    })),
    vazio: "Este usuário ainda não teve dispositivos vinculados.",
  };
};

// ===========================================================================
// 5. Movimentações por período
// ===========================================================================

/** Texto gravado por vincular_dispositivo ao encerrar o vínculo anterior. */
const ENCERRADO_POR_TRANSFERENCIA = "Encerrado por transferência";

const SELECT_MOVIMENTACAO =
  "id, dispositivo_id, data_inicio, data_fim, observacao, observacao_devolucao, criado_por, encerrado_por, loja:lojas(nome), colaborador:colaboradores(nome), dispositivo:dispositivos(tipo, marca, modelo, serial_number, imei1, numero_patrimonio)";

const dataSchema = z.iso.date();

/** "2026-11-10" → "10/11/2026". */
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/** Dia seguinte, também como "AAAA-MM-DD". */
function diaSeguinte(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** ?de e ?ate (AAAA-MM-DD); padrão: mês atual em Palmas. */
export function periodoMovimentacoes(params: URLSearchParams, agora: Date) {
  const hoje = hojeEmPalmas(agora);
  const [ano, mes] = hoje.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

  const de = params.get("de") || `${hoje.slice(0, 7)}-01`;
  const ate = params.get("ate") || ultimoDia;
  if (!dataSchema.safeParse(de).success || !dataSchema.safeParse(ate).success) {
    throw new ErroRelatorio(400, "Informe datas válidas para o período.");
  }
  if (de > ate) {
    throw new ErroRelatorio(400, "A data inicial deve ser anterior ou igual à final.");
  }
  return { de, ate };
}

type TipoMovimentacao = "Entrega" | "Transferência" | "Devolução";

const movimentacoes: Gerador = async (supabase, params, agora) => {
  const { de, ate } = periodoMovimentacoes(params, agora);
  // Palmas é UTC−3 o ano todo (sem horário de verão desde 2013).
  const inicio = `${de}T00:00:00-03:00`;
  const fim = `${diaSeguinte(ate)}T00:00:00-03:00`;

  const [criados, encerrados] = await Promise.all([
    buscarTodas((a, b) =>
      supabase
        .from("vinculos")
        .select(SELECT_MOVIMENTACAO)
        .gte("data_inicio", inicio)
        .lt("data_inicio", fim)
        .order("data_inicio")
        .order("id")
        .range(a, b),
    ),
    buscarTodas((a, b) =>
      supabase
        .from("vinculos")
        .select(SELECT_MOVIMENTACAO)
        .gte("data_fim", inicio)
        .lt("data_fim", fim)
        .order("data_fim")
        .order("id")
        .range(a, b),
    ),
  ]);

  type V = (typeof criados)[number];

  // Transferência = vínculo encerrado "por transferência" + vínculo novo do
  // mesmo dispositivo no mesmo instante (mesma transação de vincular_dispositivo).
  const chave = (dispositivoId: string, quando: string) =>
    `${dispositivoId}|${new Date(quando).getTime()}`;
  const saidasPorTransferencia = new Map<string, V>();
  for (const v of encerrados) {
    if (v.data_fim && v.observacao_devolucao === ENCERRADO_POR_TRANSFERENCIA) {
      saidasPorTransferencia.set(chave(v.dispositivo_id, v.data_fim), v);
    }
  }

  type Evento = {
    quando: Date;
    operacao: TipoMovimentacao;
    v: V;
    de: string | null;
    para: string | null;
    por: string | null;
    observacao: string | null;
  };
  const eventos: Evento[] = [];
  const usadas = new Set<string>();

  for (const v of criados) {
    const anterior = saidasPorTransferencia.get(chave(v.dispositivo_id, v.data_inicio));
    if (anterior) usadas.add(anterior.id);
    eventos.push({
      quando: new Date(v.data_inicio),
      operacao: anterior ? "Transferência" : "Entrega",
      v,
      de: anterior?.colaborador?.nome ?? null,
      para: v.colaborador?.nome ?? null,
      por: v.criado_por,
      observacao: v.observacao,
    });
  }
  for (const v of encerrados) {
    if (!v.data_fim || usadas.has(v.id)) continue;
    const transferencia = v.observacao_devolucao === ENCERRADO_POR_TRANSFERENCIA;
    eventos.push({
      quando: new Date(v.data_fim),
      // Saída de transferência cujo vínculo novo não foi encontrado (raro).
      operacao: transferencia ? "Transferência" : "Devolução",
      v,
      de: v.colaborador?.nome ?? null,
      para: null,
      por: v.encerrado_por,
      observacao: transferencia ? null : v.observacao_devolucao,
    });
  }
  if (eventos.length > LIMITE_LINHAS) throw new ErroRelatorio(422, MSG_LIMITE);
  eventos.sort((a, b) => a.quando.getTime() - b.quando.getTime());

  // Quem fez a operação: e-mails em auth.users, via função restrita (migration 007).
  const ids = [...new Set(eventos.map((e) => e.por).filter((x): x is string => !!x))];
  const emails = new Map<string, string>();
  if (ids.length) {
    const { data, error } = await supabase.rpc("emails_operadores", { p_ids: ids });
    if (error) throw new Error(error.message);
    for (const u of data) emails.set(u.id, u.email);
  }

  const contagem = (tipo: TipoMovimentacao) => eventos.filter((e) => e.operacao === tipo).length;

  return {
    slug: "movimentacoes",
    titulo: "Movimentações por período",
    aba: "Movimentações",
    orientacao: "paisagem",
    filtros: [
      { rotulo: "Período", valor: `${dataBR(de)} a ${dataBR(ate)}` },
      {
        rotulo: "Totais",
        valor: `${contagem("Entrega")} entregas · ${contagem("Transferência")} transferências · ${contagem("Devolução")} devoluções`,
      },
    ],
    colunas: [
      { chave: "quando", titulo: "Data/hora", tipo: "dataHora", peso: 1 },
      { chave: "operacao", titulo: "Operação", peso: 0.9 },
      { chave: "dispositivo", titulo: "Dispositivo", peso: 1.3 },
      { chave: "identificador", titulo: "Identificador", peso: 1.3 },
      { chave: "de", titulo: "De", peso: 1.2 },
      { chave: "para", titulo: "Para", peso: 1.2 },
      { chave: "loja", titulo: "Loja", peso: 1 },
      { chave: "por", titulo: "Realizado por", peso: 1.4 },
      { chave: "observacao", titulo: "Observação", peso: 1.3 },
    ],
    linhas: eventos.map((e) => ({
      quando: e.quando,
      operacao: e.operacao,
      dispositivo: e.v.dispositivo ? `${e.v.dispositivo.marca} ${e.v.dispositivo.modelo}` : null,
      identificador: e.v.dispositivo ? identificadorDispositivo(e.v.dispositivo) : null,
      de: e.de,
      para: e.para,
      loja: e.v.loja?.nome ?? null,
      por: e.por ? (emails.get(e.por) ?? "—") : "—",
      observacao: e.observacao,
    })),
    vazio: "Nenhuma movimentação no período.",
  };
};

// ===========================================================================
// 6. Vínculos sem termo
// ===========================================================================

const vinculosSemTermo: Gerador = async (supabase, params, agora) => {
  const lojaId = lojaDoParametro(params);

  const dados = await buscarTodas((de, ate) => {
    let q = supabase
      .from("vinculos")
      .select(
        "id, data_inicio, loja:lojas(nome), colaborador:colaboradores(nome), dispositivo:dispositivos(tipo, marca, modelo, serial_number, imei1, numero_patrimonio)",
      )
      .is("data_fim", null)
      .is("termo_path", null)
      .order("data_inicio") // mais antigo primeiro
      .order("id")
      .range(de, ate);
    if (lojaId) q = q.eq("loja_id", lojaId);
    return q;
  });

  return {
    slug: "vinculos-sem-termo",
    titulo: "Vínculos sem termo",
    aba: "Sem termo",
    orientacao: "retrato",
    filtros: [
      { rotulo: "Vínculos", valor: "em aberto, sem termo de responsabilidade" },
      lojaId
        ? { rotulo: "Loja", valor: (await nomeDaLoja(supabase, lojaId)) ?? "" }
        : { rotulo: "Lojas", valor: "todas" },
      { rotulo: "Posição em", valor: formatarData(agora) },
    ],
    colunas: [
      { chave: "desde", titulo: "Desde", tipo: "data", peso: 0.8 },
      { chave: "ha", titulo: "Há", peso: 1.1 },
      { chave: "dispositivo", titulo: "Dispositivo", peso: 1.4 },
      { chave: "identificador", titulo: "Identificador", peso: 1.4 },
      { chave: "usuario", titulo: "Usuário", peso: 1.4 },
      { chave: "loja", titulo: "Loja", peso: 1 },
    ],
    linhas: dados.map((v) => ({
      desde: new Date(v.data_inicio),
      ha: formatarDuracao(v.data_inicio, agora),
      dispositivo: v.dispositivo ? `${v.dispositivo.marca} ${v.dispositivo.modelo}` : null,
      identificador: v.dispositivo ? identificadorDispositivo(v.dispositivo) : null,
      usuario: v.colaborador?.nome ?? null,
      loja: v.loja?.nome ?? null,
    })),
    vazio: "Todos os vínculos em aberto têm termo anexado.",
  };
};

export const GERADORES: Record<TipoRelatorio, Gerador> = {
  inventario,
  "dispositivos-por-loja": dispositivosPorLoja,
  "historico-dispositivo": historicoDispositivo,
  "historico-usuario": historicoUsuario,
  movimentacoes,
  "vinculos-sem-termo": vinculosSemTermo,
};
