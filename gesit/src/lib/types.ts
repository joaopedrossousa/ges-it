/**
 * Aliases dos tipos gerados do banco + textos em português para a interface.
 *
 * Os tipos vêm de `database.types.ts`, gerado com `npm run gen:types`.
 * Não edite aquele arquivo à mão: altere o SQL e gere de novo.
 *
 * Lembretes:
 * - CPF e IMEI são guardados só com dígitos.
 * - Na view vw_dispositivos todas as colunas vêm como anuláveis
 *   (o Postgres não propaga NOT NULL em views).
 */

import {
  Constants,
  type Database,
  type Enums,
  type Tables,
  type TablesInsert,
  type TablesUpdate,
} from "./database.types";

export type { Database };

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type TipoDispositivo = Enums<"tipo_dispositivo">;
export type StatusDispositivo = Enums<"status_dispositivo">;
export type TipoServico = Enums<"tipo_servico">;

export const TIPOS_DISPOSITIVO = Constants.public.Enums.tipo_dispositivo;
export const STATUS_DISPOSITIVO = Constants.public.Enums.status_dispositivo;
export const TIPOS_SERVICO = Constants.public.Enums.tipo_servico;

export const TIPO_SERVICO_LABEL: Record<TipoServico, string> = {
  formatacao: "Formatação",
  troca_tela: "Troca de tela",
  troca_bateria: "Troca de bateria",
  troca_teclado: "Troca de teclado",
  limpeza: "Limpeza",
  reparo_placa: "Reparo de placa",
  atualizacao_sistema: "Atualização de sistema",
  outro: "Outro",
};

/**
 * Status que o usuário pode escolher (formulários, diálogo de status e
 * devolução). "em_uso" fica de fora: só vincular_dispositivo o define.
 */
export const STATUS_EDITAVEIS = [
  "disponivel",
  "manutencao",
  "baixado",
] as const satisfies readonly StatusDispositivo[];
export type StatusEditavel = (typeof STATUS_EDITAVEIS)[number];

export function ehStatusDispositivo(valor: unknown): valor is StatusDispositivo {
  return (STATUS_DISPOSITIVO as readonly unknown[]).includes(valor);
}

export function ehStatusEditavel(valor: unknown): valor is StatusEditavel {
  return (STATUS_EDITAVEIS as readonly unknown[]).includes(valor);
}

export const TIPO_DISPOSITIVO_LABEL: Record<TipoDispositivo, string> = {
  notebook: "Notebook",
  telefone: "Telefone",
  monitor: "Monitor",
};

/** Plural em minúsculas, para textos como "3 monitores". */
export const TIPO_DISPOSITIVO_PLURAL: Record<TipoDispositivo, string> = {
  notebook: "notebooks",
  telefone: "telefones",
  monitor: "monitores",
};

/** Operadoras aceitas pela check operadora_valida (migration 009). */
export const OPERADORAS = ["Vivo", "Claro", "TIM", "Oi", "Algar", "Outra"] as const;
export type Operadora = (typeof OPERADORAS)[number];

/** A coluna é text no banco; converte para o tipo (null se vazia ou desconhecida). */
export function paraOperadora(valor: string | null | undefined): Operadora | null {
  return (OPERADORAS as readonly unknown[]).includes(valor) ? (valor as Operadora) : null;
}

/**
 * Situação da vida útil calculada na vw_dispositivos (migration 009).
 * "baixado" fica fora dos alertas e dos filtros.
 */
export const SITUACOES_VIDA_UTIL = ["ok", "proximo", "vencido", "sem_data", "baixado"] as const;
export type SituacaoVidaUtil = (typeof SITUACOES_VIDA_UTIL)[number];

/** Situações que aparecem no filtro da listagem. */
export const SITUACOES_VIDA_UTIL_FILTRO = [
  "ok",
  "proximo",
  "vencido",
  "sem_data",
] as const satisfies readonly SituacaoVidaUtil[];

export const SITUACAO_VIDA_UTIL_LABEL: Record<SituacaoVidaUtil, string> = {
  ok: "OK",
  proximo: "Próximo da troca",
  vencido: "Vencido",
  sem_data: "Sem data",
  baixado: "Baixado",
};

/** A view devolve text; converte para o tipo (null se desconhecido). */
export function paraSituacaoVidaUtil(valor: unknown): SituacaoVidaUtil | null {
  return (SITUACOES_VIDA_UTIL as readonly unknown[]).includes(valor)
    ? (valor as SituacaoVidaUtil)
    : null;
}

export const STATUS_DISPOSITIVO_LABEL: Record<StatusDispositivo, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
  baixado: "Baixado",
};

// ---------------------------------------------------------------------------
// Tabelas
// ---------------------------------------------------------------------------

export type LojaRow = Tables<"lojas">;
export type LojaInsert = TablesInsert<"lojas">;
export type LojaUpdate = TablesUpdate<"lojas">;

/** "Usuários" na interface. */
export type ColaboradorRow = Tables<"colaboradores">;
export type ColaboradorInsert = TablesInsert<"colaboradores">;
export type ColaboradorUpdate = TablesUpdate<"colaboradores">;

export type DispositivoRow = Tables<"dispositivos">;
export type DispositivoInsert = TablesInsert<"dispositivos">;
export type DispositivoUpdate = TablesUpdate<"dispositivos">;

/** Para criar vínculos use a RPC vincular_dispositivo, não insert direto. */
export type VinculoRow = Tables<"vinculos">;
export type VinculoInsert = TablesInsert<"vinculos">;
export type VinculoUpdate = TablesUpdate<"vinculos">;

export type ServicoRow = Tables<"servicos">;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export type VwDispositivoRow = Tables<"vw_dispositivos">;

// ---------------------------------------------------------------------------
// Funções SQL (supabase.rpc)
// ---------------------------------------------------------------------------

type Functions = Database["public"]["Functions"];

/** Retorna o id (uuid) do novo vínculo. */
export type VincularDispositivoArgs = Functions["vincular_dispositivo"]["Args"];

/** `p_novo_status` não pode ser "em_uso" (o SQL rejeita); use StatusEditavel. */
export type DevolverDispositivoArgs = Functions["devolver_dispositivo"]["Args"];
