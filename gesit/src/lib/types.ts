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

export const TIPOS_DISPOSITIVO = Constants.public.Enums.tipo_dispositivo;
export const STATUS_DISPOSITIVO = Constants.public.Enums.status_dispositivo;

export const TIPO_DISPOSITIVO_LABEL: Record<TipoDispositivo, string> = {
  notebook: "Notebook",
  telefone: "Telefone",
};

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

/** `p_novo_status` não pode ser "em_uso" (o SQL rejeita). */
export type DevolverDispositivoArgs = Functions["devolver_dispositivo"]["Args"];
