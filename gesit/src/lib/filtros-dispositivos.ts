import { z } from "zod";

import { limparBusca, primeiro } from "@/lib/busca";
import {
  STATUS_DISPOSITIVO,
  TIPOS_DISPOSITIVO,
  type StatusDispositivo,
  type TipoDispositivo,
} from "@/lib/types";
import { somenteDigitos } from "@/lib/validators";

/** Filtros da listagem /dispositivos (também usados no relatório de inventário). */
export type FiltrosDispositivos = {
  busca: string;
  tipo?: TipoDispositivo;
  status?: StatusDispositivo;
  /** Loja gravada no vínculo aberto (loja_id da vw_dispositivos). */
  lojaId?: string;
};

type Params =
  | Record<string, string | string[] | undefined>
  | URLSearchParams;

const tipoSchema = z.enum(TIPOS_DISPOSITIVO);
const statusSchema = z.enum(STATUS_DISPOSITIVO);

/** Lê ?q, ?tipo, ?status e ?loja; valores inválidos são ignorados. */
export function lerFiltrosDispositivos(params: Params): FiltrosDispositivos {
  const ler = (chave: string) =>
    params instanceof URLSearchParams
      ? (params.get(chave) ?? undefined)
      : primeiro(params[chave]);

  const loja = ler("loja");
  return {
    busca: limparBusca(ler("q") ?? "").slice(0, 100),
    tipo: tipoSchema.safeParse(ler("tipo")).data,
    status: statusSchema.safeParse(ler("status")).data,
    lojaId: z.uuid().safeParse(loja).success ? loja : undefined,
  };
}

/**
 * Expressão para .or() da busca: marca, modelo, serial e, com 3+ dígitos,
 * IMEI 1 e 2. Null se não houver busca.
 */
export function filtroBuscaDispositivos(busca: string): string | null {
  if (!busca) return null;
  const filtros = [
    `marca.ilike.%${busca}%`,
    `modelo.ilike.%${busca}%`,
    `serial_number.ilike.%${busca}%`,
  ];
  const digitos = somenteDigitos(busca);
  if (digitos.length >= 3) {
    filtros.push(`imei1.like.%${digitos}%`, `imei2.like.%${digitos}%`);
  }
  return filtros.join(",");
}
