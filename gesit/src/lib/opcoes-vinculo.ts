import { identificadorDispositivo } from "@/lib/dispositivos";
import type { StatusDispositivo, TipoDispositivo } from "@/lib/types";

/** Dispositivo no combobox do diálogo de vincular. */
export type DispositivoOpcao = {
  id: string;
  tipo: TipoDispositivo;
  marca: string;
  modelo: string;
  /** IMEI 1 formatado (telefone), patrimônio (monitor) ou Serial Number. */
  identificador: string;
  status: StatusDispositivo;
  /** Usuário atual, se houver vínculo aberto. */
  colaborador_id: string | null;
  colaborador_nome: string | null;
};

/** Colaborador ativo no combobox do diálogo de vincular (sem CPF). */
export type ColaboradorOpcao = {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  loja_nome: string | null;
};

/** Status que aceitam vínculo (vincular_dispositivo recusa manutenção/baixado). */
export const STATUS_VINCULAVEIS = ["disponivel", "em_uso"] as const;

type LinhaVwDispositivo = {
  id: string | null;
  tipo: TipoDispositivo | null;
  marca: string | null;
  modelo: string | null;
  serial_number: string | null;
  imei1: string | null;
  numero_patrimonio: string | null;
  status: StatusDispositivo | null;
  colaborador_id: string | null;
  colaborador_nome: string | null;
};

/** Converte uma linha da vw_dispositivos (colunas anuláveis); null se incompleta. */
export function paraDispositivoOpcao(d: LinhaVwDispositivo): DispositivoOpcao | null {
  if (!d.id || !d.tipo || !d.status || d.marca === null || d.modelo === null) return null;
  return {
    id: d.id,
    tipo: d.tipo,
    marca: d.marca,
    modelo: d.modelo,
    identificador: identificadorDispositivo(d),
    status: d.status,
    colaborador_id: d.colaborador_id,
    colaborador_nome: d.colaborador_nome,
  };
}
