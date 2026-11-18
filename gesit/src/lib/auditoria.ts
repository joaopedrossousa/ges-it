import { COR_LABEL, PRIORIDADE_LABEL } from "@/lib/atividades";
import type { Json } from "@/lib/database.types";
import {
  SITUACAO_PAGAMENTO_LABEL,
  TIPO_DESPESA_LABEL,
  ehSituacaoPagamento,
  ehTipoDespesa,
  formatarCompetenciaCurta,
  rotuloAprovacao,
} from "@/lib/financeiro";
import { formatarDataHora, formatarDataISO, formatarMoeda } from "@/lib/format";
import { rotulosPerifericos } from "@/lib/perifericos";
import {
  MOMENTO_IMAGEM_LABEL,
  MOTIVO_BAIXA_LABEL,
  STATUS_DISPOSITIVO_LABEL,
  TIPO_DISPOSITIVO_LABEL,
  ehMomentoImagem,
  ehMotivoBaixa,
  TIPO_SERVICO_LABEL,
  ehStatusDispositivo,
  type TipoDispositivo,
  type TipoServico,
} from "@/lib/types";
import { formatarIMEI, formatarLinha } from "@/lib/validators";

// ===========================================================================
// Tabelas e ações (checks das migrations 012, 015 e 017)
// ===========================================================================

/** Na ordem dos filtros. */
export const TABELAS_AUDITORIA = [
  "colaboradores",
  "dispositivos",
  "dispositivo_imagens",
  "lojas",
  "vinculos",
  "servicos",
  "servicos_financeiros",
  "lancamentos",
  "kanban_atividades",
  "kanban_comentarios",
  "kanban_colunas",
  "kanban_categorias",
  "perfis_usuarios",
] as const;
export type TabelaAuditoria = (typeof TABELAS_AUDITORIA)[number];

export const TIPO_REGISTRO_LABEL: Record<TabelaAuditoria, string> = {
  colaboradores: "Colaborador",
  dispositivos: "Dispositivo",
  dispositivo_imagens: "Imagem de Dispositivo",
  lojas: "Loja",
  vinculos: "Vínculo",
  servicos: "Serviço",
  servicos_financeiros: "Serviço Financeiro",
  lancamentos: "Lançamento",
  kanban_atividades: "Atividade",
  kanban_comentarios: "Comentário de Atividade",
  kanban_colunas: "Coluna do Quadro",
  kanban_categorias: "Categoria de Atividade",
  perfis_usuarios: "Usuário do Sistema",
};

export const ACOES_AUDITORIA = ["insercao", "alteracao"] as const;
export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];

export const ACAO_LABEL: Record<AcaoAuditoria, string> = {
  insercao: "Inserção",
  alteracao: "Alteração",
};

export function ehTabelaAuditoria(v: unknown): v is TabelaAuditoria {
  return (TABELAS_AUDITORIA as readonly unknown[]).includes(v);
}

export function ehAcaoAuditoria(v: unknown): v is AcaoAuditoria {
  return (ACOES_AUDITORIA as readonly unknown[]).includes(v);
}

// ===========================================================================
// Nomes dos campos em português
// ===========================================================================

const CAMPOS_COMUNS: Record<string, string> = {
  nome: "Nome",
  ativo: "Ativo",
  observacao: "Observação",
};

const CAMPOS: Record<TabelaAuditoria, Record<string, string>> = {
  lojas: { ...CAMPOS_COMUNS, cidade: "Cidade" },
  colaboradores: {
    ...CAMPOS_COMUNS,
    cargo: "Cargo",
    loja_id: "Loja",
    cpf: "CPF",
    email: "E-mail",
  },
  dispositivos: {
    ...CAMPOS_COMUNS,
    tipo: "Tipo",
    marca: "Marca",
    // Infraestrutura (migration 018): o que é o item (Access Point, Switch...).
    equipamento: "Dispositivo",
    modelo: "Modelo",
    serial_number: "Serial Number",
    imei1: "IMEI 1",
    imei2: "IMEI 2",
    status: "Status",
    numero_patrimonio: "Nº de patrimônio",
    numero_linha: "Número da linha",
    operadora: "Operadora",
    data_compra: "Data de compra",
    fim_vida_util: "Fim da vida útil",
    nota_fiscal_path: "Nota fiscal",
    loja_estoque_id: "Filial de estoque",
    // Baixa (migration 019): baixar_dispositivo junta na linha da mudança de status.
    baixa_motivo: "Motivo da baixa",
    baixa_informacoes: "Informações da baixa",
    baixa_data: "Data da baixa",
    baixa_anexos: "Anexos da baixa",
  },
  // Migration 020: inserção e remoção (removida/removida_em).
  dispositivo_imagens: {
    dispositivo_id: "Dispositivo",
    vinculo_id: "Vínculo",
    momento: "Momento",
    legenda: "Legenda",
    path: "Imagem",
    removida: "Removida",
    removida_em: "Removida em",
  },
  vinculos: {
    dispositivo_id: "Dispositivo",
    colaborador_id: "Colaborador",
    loja_id: "Loja",
    data_inicio: "Início",
    data_fim: "Fim",
    termo_path: "Termo",
    observacao: "Observação da entrega",
    observacao_devolucao: "Observação da devolução",
    perifericos_entrega: "Periféricos entregues",
    perifericos_devolucao: "Periféricos devolvidos",
    formatado_entrega: "Formatado na entrega",
    formatado_devolucao: "Formatado na devolução",
  },
  servicos: {
    dispositivo_id: "Dispositivo",
    tipo: "Tipo de serviço",
    data_servico: "Data do serviço",
    fornecedor: "Prestador de serviço",
    custo: "Custo",
    na_garantia: "Na garantia",
    descricao: "Descrição",
    anexo_path: "Anexo",
  },
  servicos_financeiros: {
    ...CAMPOS_COMUNS,
    tipo: "Tipo",
    fornecedor: "Fornecedor",
    descricao: "Descrição",
    identificador: "Identificador",
    loja_id: "Filial",
    dia_vencimento: "Dia de vencimento",
    valor_referencia: "Valor de referência",
  },
  lancamentos: {
    observacao: "Observação",
    competencia: "Competência",
    servico_id: "Serviço",
    tipo: "Tipo",
    fornecedor: "Fornecedor",
    descricao: "Descrição",
    loja_id: "Filial",
    vencimento: "Vencimento",
    valor: "Valor",
    situacao: "Situação",
    id_aprovacao: "ID da aprovação",
    aprovacao_ok: "Aprovação",
    data_pagamento: "Data do pagamento",
    anexo_path: "Anexo",
  },
  kanban_atividades: {
    coluna_id: "Coluna",
    titulo: "Título",
    descricao: "Descrição",
    prioridade: "Prioridade",
    responsavel_id: "Responsável",
    prazo: "Prazo",
    arquivada: "Arquivada",
    categorias: "Categorias",
    // Migration 022
    urgente: "Urgente",
    urgente_por: "Marcada como urgente por",
    urgente_em: "Urgente desde",
  },
  kanban_comentarios: {
    atividade_id: "Atividade",
    texto: "Comentário",
    anexos: "Imagens",
    editado_em: "Editado em",
    removido: "Removido",
    removido_em: "Removido em",
  },
  kanban_colunas: {
    nome: "Nome",
    cor: "Cor",
    arquivada: "Arquivada",
  },
  kanban_categorias: {
    nome: "Nome",
    cor: "Cor",
    ativa: "Ativa",
  },
  // Migration 027: nome de exibição (Administração > Usuários).
  perfis_usuarios: {
    nome_exibicao: "Nome de exibição",
  },
};

/**
 * Campos que não aparecem nas alterações: o autor já está na coluna
 * Usuário do log (alterado_por), e created_at/updated_at são técnicos.
 */
const CAMPOS_OCULTOS = new Set([
  "criado_por",
  "encerrado_por",
  "created_at",
  "updated_at",
  "id",
  "posicao",
  // Imagens: quem removeu já é o Usuário do log.
  "removida_por",
  // Comentários: o autor é o Usuário do log da inserção.
  "autor_id",
]);

/**
 * Flags que nascem falsas e não dizem nada na inclusão ("Removido: Não",
 * "Arquivada: Não"): só aparecem quando mudam ou nascem verdadeiras.
 */
const FLAGS_OCULTAS_NA_INCLUSAO = new Set(["removido", "removida", "arquivada", "urgente"]);

/** Caminhos de arquivo: mostrados como "arquivo anexado/substituído". */
const CAMPOS_ARQUIVO = new Set(["termo_path", "nota_fiscal_path", "anexo_path", "path"]);

const DATAS = new Set(["baixa_data", "data_compra", "fim_vida_util", "data_servico", "vencimento", "data_pagamento", "prazo"]);
const MOEDA = new Set(["custo", "valor", "valor_referencia"]);
const DATAS_HORA = new Set([
  "data_inicio",
  "data_fim",
  "removida_em",
  "urgente_em",
  "editado_em",
  "removido_em",
]);

export function rotuloCampo(tabela: TabelaAuditoria, campo: string): string {
  return CAMPOS[tabela][campo] ?? campo;
}

// ===========================================================================
// Valores
// ===========================================================================

/** Nomes já carregados do banco para ids que aparecem no log. */
export type NomesAuditoria = {
  lojas: Map<string, string>;
  colaboradores: Map<string, string>;
  dispositivos: Map<string, string>;
  /** Vínculo → nome do colaborador (imagens de entrega/transferência/devolução). */
  vinculos: Map<string, string>;
  /** Atividade → título (comentários). */
  atividades: Map<string, string>;
  servicosFinanceiros: Map<string, string>;
  colunasKanban: Map<string, string>;
  categoriasKanban: Map<string, string>;
  /** E-mail (ou nome) dos usuários do sistema (responsável). */
  usuarios: Map<string, string>;
};

const texto = (v: Json | undefined): string | null =>
  typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : null;

/** Valor de um campo do log em português; "—" para vazio. */
export function formatarValorAuditoria(
  tabela: TabelaAuditoria,
  campo: string,
  valor: Json | undefined,
  nomes: NomesAuditoria,
): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (campo === "aprovacao_ok" && typeof valor === "boolean") return rotuloAprovacao(valor);
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (campo === "categorias" && Array.isArray(valor)) {
    const lista = valor.map((id) => (typeof id === "string" && nomes.categoriasKanban.get(id)) || "Categoria não encontrada");
    return lista.join(", ") || "Nenhuma";
  }
  if ((campo === "baixa_anexos" || campo === "anexos") && Array.isArray(valor)) {
    return valor.filter((x): x is string => typeof x === "string").join(", ") || "Nenhum";
  }
  if (Array.isArray(valor)) {
    return rotulosPerifericos(valor.filter((x): x is string => typeof x === "string")) || "Nenhum";
  }

  const s = texto(valor);
  if (s === null) return JSON.stringify(valor);

  if (campo === "loja_id" || campo === "loja_estoque_id") return nomes.lojas.get(s) ?? "Loja não encontrada";
  if (campo === "colaborador_id") return nomes.colaboradores.get(s) ?? "Colaborador não encontrado";
  if (campo === "dispositivo_id") return nomes.dispositivos.get(s) ?? "Dispositivo não encontrado";
  if (campo === "vinculo_id") return nomes.vinculos.get(s) ?? "Vínculo não encontrado";
  if (campo === "momento" && ehMomentoImagem(s)) return MOMENTO_IMAGEM_LABEL[s];
  if (campo === "coluna_id") return nomes.colunasKanban.get(s) ?? "Coluna não encontrada";
  if (campo === "responsavel_id" || campo === "urgente_por") {
    return nomes.usuarios.get(s) ?? "Usuário removido";
  }
  if (campo === "atividade_id") return nomes.atividades.get(s) ?? "Atividade não encontrada";
  if (campo === "prioridade") return PRIORIDADE_LABEL[s as keyof typeof PRIORIDADE_LABEL] ?? s;
  if (campo === "cor") return COR_LABEL[s as keyof typeof COR_LABEL] ?? s;
  if (campo === "servico_id") return nomes.servicosFinanceiros.get(s) ?? "Serviço não encontrado";
  if (campo === "status" && ehStatusDispositivo(s)) return STATUS_DISPOSITIVO_LABEL[s];
  if (campo === "baixa_motivo" && ehMotivoBaixa(s)) return MOTIVO_BAIXA_LABEL[s];
  if (campo === "tipo" && tabela === "dispositivos") {
    return TIPO_DISPOSITIVO_LABEL[s as TipoDispositivo] ?? s;
  }
  if (campo === "tipo" && tabela === "servicos") return TIPO_SERVICO_LABEL[s as TipoServico] ?? s;
  if (campo === "tipo" && ehTipoDespesa(s)) return TIPO_DESPESA_LABEL[s];
  if (campo === "situacao" && ehSituacaoPagamento(s)) return SITUACAO_PAGAMENTO_LABEL[s];
  if (campo === "competencia") return formatarCompetenciaCurta(s);
  if (campo === "imei1" || campo === "imei2") return formatarIMEI(s);
  if (campo === "numero_linha") return formatarLinha(s);
  if (MOEDA.has(campo)) return formatarMoeda(Number(s));
  if (DATAS.has(campo)) return formatarDataISO(s);
  if (DATAS_HORA.has(campo)) return formatarDataHora(s);
  return s;
}

// ===========================================================================
// Alterações de uma linha do log
// ===========================================================================

export type Alteracao = { campo: string; texto: string };

const comoObjeto = (j: Json | null): Record<string, Json | undefined> =>
  j && typeof j === "object" && !Array.isArray(j) ? j : {};

/**
 * "Campo: antes → depois" (alteração) ou "Campo: valor" (inserção), na
 * ordem de campos_alterados. Arquivos viram "arquivo anexado/substituído".
 */
export function descreverAlteracoes(
  linha: {
    tabela: TabelaAuditoria;
    acao: AcaoAuditoria;
    campos_alterados: string[];
    antes: Json | null;
    depois: Json | null;
  },
  nomes: NomesAuditoria,
): Alteracao[] {
  const antes = comoObjeto(linha.antes);
  const depois = comoObjeto(linha.depois);
  const fmt = (campo: string, v: Json | undefined) =>
    formatarValorAuditoria(linha.tabela, campo, v, nomes);

  return linha.campos_alterados
    .filter((campo) => !CAMPOS_OCULTOS.has(campo))
    .filter(
      (campo) =>
        !(linha.acao === "insercao" && FLAGS_OCULTAS_NA_INCLUSAO.has(campo) && depois[campo] === false),
    )
    .map((campo) => {
      const rotulo = rotuloCampo(linha.tabela, campo);

      if (CAMPOS_ARQUIVO.has(campo)) {
        const tinha = Boolean(antes[campo]);
        const tem = Boolean(depois[campo]);
        const t = !tem ? "arquivo removido" : tinha ? "arquivo substituído" : "arquivo anexado";
        return { campo: rotulo, texto: t };
      }

      if (linha.acao === "insercao") return { campo: rotulo, texto: fmt(campo, depois[campo]) };
      return { campo: rotulo, texto: `${fmt(campo, antes[campo])} → ${fmt(campo, depois[campo])}` };
    });
}
