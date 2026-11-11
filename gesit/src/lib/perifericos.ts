import type { TipoDispositivo } from "@/lib/types";

/** Valores aceitos pelas checks de vinculos (migration 010), na ordem de exibição. */
export const PERIFERICOS = ["carregador", "headset", "mouse", "suporte_notebook", "chip"] as const;
export type Periferico = (typeof PERIFERICOS)[number];

export const PERIFERICO_LABEL: Record<Periferico, string> = {
  carregador: "Carregador",
  headset: "Headset",
  mouse: "Mouse",
  suporte_notebook: "Suporte notebook",
  chip: "Chip telefônico",
};

/** Mesma regra de normalizar_perifericos no banco. Monitor não tem periféricos nem "formatado". */
export const PERIFERICOS_POR_TIPO: Record<TipoDispositivo, readonly Periferico[]> = {
  notebook: ["carregador", "headset", "mouse", "suporte_notebook"],
  telefone: ["carregador", "chip"],
  monitor: [],
};

/** Notebook e telefone têm conferência de periféricos e "formatado"; monitor não. */
export function temConferencia(tipo: TipoDispositivo | null | undefined): boolean {
  return tipo === "notebook" || tipo === "telefone";
}

export function ehPeriferico(valor: unknown): valor is Periferico {
  return (PERIFERICOS as readonly unknown[]).includes(valor);
}

/** Só os itens válidos, sem repetição, na ordem de PERIFERICOS. */
export function ordenarPerifericos(lista: readonly string[] | null | undefined): Periferico[] {
  const conjunto = new Set(lista ?? []);
  return PERIFERICOS.filter((p) => conjunto.has(p));
}

/** Itens entregues que não voltaram. */
export function naoDevolvidos(
  entregues: readonly string[] | null | undefined,
  devolvidos: readonly string[] | null | undefined,
): Periferico[] {
  const voltaram = new Set(devolvidos ?? []);
  return ordenarPerifericos(entregues).filter((p) => !voltaram.has(p));
}

/** "Carregador, Mouse". */
export function rotulosPerifericos(lista: readonly string[] | null | undefined): string {
  return ordenarPerifericos(lista)
    .map((p) => PERIFERICO_LABEL[p])
    .join(", ");
}

/** Texto de "Periféricos entregues": "—" para monitor, "Nenhum" se vazio. */
export function textoEntregues(tipo: TipoDispositivo | null | undefined, entregues: readonly string[]) {
  if (!temConferencia(tipo)) return "—";
  return rotulosPerifericos(entregues) || "Nenhum";
}

/**
 * Texto de "Periféricos devolvidos": "—" para monitor ou vínculo aberto;
 * "Não conferido" se encerrado sem conferência (transferência ou antes da
 * migration 010); "Nenhum" se vazio.
 */
export function textoDevolvidos(
  tipo: TipoDispositivo | null | undefined,
  v: { data_fim: string | null; perifericos_devolucao: readonly string[] | null },
) {
  if (!temConferencia(tipo) || !v.data_fim) return "—";
  if (v.perifericos_devolucao === null) return "Não conferido";
  return rotulosPerifericos(v.perifericos_devolucao) || "Nenhum";
}

const simNao = (b: boolean | null) => (b === null ? null : b ? "Sim" : "Não");

/** Ex.: "Entrega: Sim · Devolução: Não"; "—" se nada foi registrado. */
export function textoFormatado(
  entrega: boolean | null,
  devolucao: boolean | null,
  rotulos = { entrega: "Entrega", devolucao: "Devolução" },
) {
  const partes = [
    simNao(entrega) && `${rotulos.entrega}: ${simNao(entrega)}`,
    simNao(devolucao) && `${rotulos.devolucao}: ${simNao(devolucao)}`,
  ].filter(Boolean);
  return partes.join(" · ") || "—";
}
