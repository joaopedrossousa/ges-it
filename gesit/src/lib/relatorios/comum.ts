import { z } from "zod";

import type { createClient } from "@/lib/supabase/server";

import { ErroRelatorio, LIMITE_LINHAS, MSG_LIMITE, type Relatorio } from "./tipos";

/** Auxiliares dos geradores de relatório (ativos em dados.ts, financeiro em dados-financeiro.ts). */

export type Supabase = Awaited<ReturnType<typeof createClient>>;
export type Gerador = (supabase: Supabase, params: URLSearchParams, agora: Date) => Promise<Relatorio>;

/** Máximo de linhas por resposta do PostgREST no Supabase (max-rows padrão). */
const LOTE = 1000;

type Resposta<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Busca em lotes até LIMITE_LINHAS (+1 para saber se passou do limite).
 * `consulta` precisa de ordenação estável (ex.: terminar em .order("id")).
 */
export async function buscarTodas<T>(
  consulta: (de: number, ate: number) => PromiseLike<Resposta<T>>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; de <= LIMITE_LINHAS; de += LOTE) {
    const { data, error } = await consulta(de, de + LOTE - 1);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < LOTE) break;
  }
  if (linhas.length > LIMITE_LINHAS) throw new ErroRelatorio(422, MSG_LIMITE);
  return linhas;
}

export async function nomeDaLoja(supabase: Supabase, id: string | undefined) {
  if (!id) return null;
  const { data } = await supabase.from("lojas").select("nome").eq("id", id).maybeSingle();
  return data?.nome ?? "Loja não encontrada";
}

export function lojaDoParametro(params: URLSearchParams) {
  const loja = params.get("loja");
  return z.uuid().safeParse(loja).success && loja ? loja : undefined;
}

/**
 * Data sem hora do banco ("AAAA-MM-DD") como instante ao meio-dia de Palmas:
 * o PDF e o Excel exibem no fuso de Palmas, e meia-noite UTC viraria o dia anterior.
 */
export const dataSemHora = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00-03:00`) : null);

/** "2026-11-17" → "17/11/2026". */
export const dataBR = (iso: string) => iso.split("-").reverse().join("/");
