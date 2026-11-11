import type { Json } from "@/lib/database.types";
import { formatarDataHora, formatarDataISO, formatarMoeda } from "@/lib/format";
import { rotulosPerifericos } from "@/lib/perifericos";
import {
  STATUS_DISPOSITIVO_LABEL,
  TIPO_DISPOSITIVO_LABEL,
  TIPO_SERVICO_LABEL,
  ehStatusDispositivo,
  type TipoDispositivo,
  type TipoServico,
} from "@/lib/types";
import { formatarIMEI, formatarLinha } from "@/lib/validators";

// ===========================================================================
// Tabelas e ações (checks da migration 012)
// ===========================================================================

/** Na ordem dos filtros. */
export const TABELAS_AUDITORIA = [
  "colaboradores",
  "dispositivos",
  "lojas",
  "vinculos",
  "servicos",
] as const;
export type TabelaAuditoria = (typeof TABELAS_AUDITORIA)[number];

export const TIPO_REGISTRO_LABEL: Record<TabelaAuditoria, string> = {
  colaboradores: "Usuário",
  dispositivos: "Dispositivo",
  lojas: "Loja",
  vinculos: "Vínculo",
  servicos: "Serviço",
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
  },
  vinculos: {
    dispositivo_id: "Dispositivo",
    colaborador_id: "Usuário",
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
    fornecedor: "Fornecedor",
    custo: "Custo",
    na_garantia: "Na garantia",
    descricao: "Descrição",
    anexo_path: "Anexo",
  },
};

/**
 * Campos que não aparecem nas alterações: o autor já está na coluna
 * Usuário do log (alterado_por), e created_at/updated_at são técnicos.
 */
const CAMPOS_OCULTOS = new Set(["criado_por", "encerrado_por", "created_at", "updated_at", "id"]);

/** Caminhos de arquivo: mostrados como "arquivo anexado/substituído". */
const CAMPOS_ARQUIVO = new Set(["termo_path", "nota_fiscal_path", "anexo_path"]);

const DATAS = new Set(["data_compra", "fim_vida_util", "data_servico"]);
const DATAS_HORA = new Set(["data_inicio", "data_fim"]);

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
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (Array.isArray(valor)) {
    return rotulosPerifericos(valor.filter((x): x is string => typeof x === "string")) || "Nenhum";
  }

  const s = texto(valor);
  if (s === null) return JSON.stringify(valor);

  if (campo === "loja_id") return nomes.lojas.get(s) ?? "Loja não encontrada";
  if (campo === "colaborador_id") return nomes.colaboradores.get(s) ?? "Usuário não encontrado";
  if (campo === "dispositivo_id") return nomes.dispositivos.get(s) ?? "Dispositivo não encontrado";
  if (campo === "status" && ehStatusDispositivo(s)) return STATUS_DISPOSITIVO_LABEL[s];
  if (campo === "tipo" && tabela === "dispositivos") {
    return TIPO_DISPOSITIVO_LABEL[s as TipoDispositivo] ?? s;
  }
  if (campo === "tipo" && tabela === "servicos") return TIPO_SERVICO_LABEL[s as TipoServico] ?? s;
  if (campo === "imei1" || campo === "imei2") return formatarIMEI(s);
  if (campo === "numero_linha") return formatarLinha(s);
  if (campo === "custo") return formatarMoeda(Number(s));
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
