import type { TipoDispositivo } from "@/lib/types";
import { formatarIMEI } from "@/lib/validators";

type ComIdentificacao = {
  tipo: TipoDispositivo | null;
  serial_number: string | null;
  imei1: string | null;
  numero_patrimonio: string | null;
};

type ComNome = {
  tipo: TipoDispositivo | null;
  marca: string | null;
  modelo: string | null;
  /** "Dispositivo" da infraestrutura (ex.: Access Point); nulo nos outros tipos. */
  equipamento: string | null;
};

/**
 * Telefone: IMEI 1 formatado; monitor e infraestrutura: patrimônio (na
 * infraestrutura, sem patrimônio, o Serial Number); notebook: Serial Number.
 */
export function identificadorDispositivo(d: ComIdentificacao): string {
  if (d.tipo === "telefone" && d.imei1) return formatarIMEI(d.imei1);
  if ((d.tipo === "monitor" || d.tipo === "infraestrutura") && d.numero_patrimonio) {
    return d.numero_patrimonio;
  }
  return (
    d.serial_number ??
    (d.imei1 ? formatarIMEI(d.imei1) : null) ??
    d.numero_patrimonio ??
    "—"
  );
}

/**
 * Nome curto: "Dell Latitude 5440"; na infraestrutura (sem marca), o que é
 * o item + modelo: "Access Point UniFi U6-Lite".
 */
export function nomeDispositivo(d: ComNome): string {
  const principal = d.tipo === "infraestrutura" ? d.equipamento : d.marca;
  return [principal, d.modelo].filter(Boolean).join(" ") || "Dispositivo";
}

/** Ex.: "Dell Latitude 5440 · ABC123". */
export function descricaoDispositivo(d: ComIdentificacao & ComNome): string {
  return `${nomeDispositivo(d)} · ${identificadorDispositivo(d)}`;
}
