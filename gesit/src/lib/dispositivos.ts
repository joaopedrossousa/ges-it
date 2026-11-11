import type { TipoDispositivo } from "@/lib/types";
import { formatarIMEI } from "@/lib/validators";

type ComIdentificacao = {
  tipo: TipoDispositivo | null;
  serial_number: string | null;
  imei1: string | null;
  numero_patrimonio: string | null;
};

/** Telefone: IMEI 1 formatado; monitor: patrimônio; notebook: Serial Number. */
export function identificadorDispositivo(d: ComIdentificacao): string {
  if (d.tipo === "telefone" && d.imei1) return formatarIMEI(d.imei1);
  if (d.tipo === "monitor" && d.numero_patrimonio) return d.numero_patrimonio;
  return (
    d.serial_number ??
    (d.imei1 ? formatarIMEI(d.imei1) : null) ??
    d.numero_patrimonio ??
    "—"
  );
}

/** Ex.: "Dell Latitude 5440 · ABC123". */
export function descricaoDispositivo(
  d: ComIdentificacao & { marca: string | null; modelo: string | null },
): string {
  return `${d.marca ?? ""} ${d.modelo ?? ""} · ${identificadorDispositivo(d)}`.trim();
}
