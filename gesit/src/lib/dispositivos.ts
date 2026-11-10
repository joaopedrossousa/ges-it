import type { TipoDispositivo } from "@/lib/types";
import { formatarIMEI } from "@/lib/validators";

type ComIdentificacao = {
  tipo: TipoDispositivo | null;
  serial_number: string | null;
  imei1: string | null;
};

/** Telefone: IMEI 1 formatado; notebook: Serial Number. */
export function identificadorDispositivo(d: ComIdentificacao): string {
  if (d.tipo === "telefone" && d.imei1) return formatarIMEI(d.imei1);
  return d.serial_number ?? (d.imei1 ? formatarIMEI(d.imei1) : "—");
}

/** Ex.: "Dell Latitude 5440 · ABC123". */
export function descricaoDispositivo(
  d: ComIdentificacao & { marca: string | null; modelo: string | null },
): string {
  return `${d.marca ?? ""} ${d.modelo ?? ""} · ${identificadorDispositivo(d)}`.trim();
}
