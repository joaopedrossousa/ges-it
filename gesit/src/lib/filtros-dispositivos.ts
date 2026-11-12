import { z } from "zod";

import { limparBusca, primeiro } from "@/lib/busca";
import {
  SITUACOES_VIDA_UTIL_FILTRO,
  STATUS_DISPOSITIVO,
  TIPOS_DISPOSITIVO,
  type SituacaoVidaUtil,
  type StatusDispositivo,
  type TipoDispositivo,
} from "@/lib/types";
import { somenteDigitos } from "@/lib/validators";

/** Filtros da listagem /dispositivos (também usados no relatório de inventário). */
export type FiltrosDispositivos = {
  busca: string;
  tipo?: TipoDispositivo;
  status?: StatusDispositivo;
  /** Loja atual: a do vínculo aberto ou, sem vínculo, a filial de estoque (loja_atual_id). */
  lojaId?: string;
  /** situacao_vida_util da vw_dispositivos (sem "baixado"). */
  vidaUtil?: SituacaoVidaUtil;
};

type Params =
  | Record<string, string | string[] | undefined>
  | URLSearchParams;

const tipoSchema = z.enum(TIPOS_DISPOSITIVO);
const statusSchema = z.enum(STATUS_DISPOSITIVO);
const vidaUtilSchema = z.enum(SITUACOES_VIDA_UTIL_FILTRO);

/** Lê ?q, ?tipo, ?status, ?loja e ?vida; valores inválidos são ignorados. */
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
    vidaUtil: vidaUtilSchema.safeParse(ler("vida")).data,
  };
}

/**
 * Expressão para .or() da busca: marca, modelo, serial, patrimônio e, com
 * 3+ dígitos, IMEI 1 e 2 e número da linha. Null se não houver busca.
 */
export function filtroBuscaDispositivos(busca: string): string | null {
  if (!busca) return null;
  const filtros = [
    `marca.ilike.%${busca}%`,
    `modelo.ilike.%${busca}%`,
    `serial_number.ilike.%${busca}%`,
    `numero_patrimonio.ilike.%${busca}%`,
  ];
  const digitos = somenteDigitos(busca);
  if (digitos.length >= 3) {
    filtros.push(
      `imei1.like.%${digitos}%`,
      `imei2.like.%${digitos}%`,
      `numero_linha.like.%${digitos}%`,
    );
  }
  return filtros.join(",");
}
