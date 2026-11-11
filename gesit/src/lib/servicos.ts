import type { TipoServico } from "@/lib/types";

/** Alerta a partir de quantas ocorrências do mesmo tipo na janela. */
export const LIMITE_REPETICAO = 3;

/** "AAAA-MM-DD" de 12 meses antes (29/02 vira 28/02 por comparação de texto). */
export function dozeMesesAntes(hojeIso: string): string {
  return `${Number(hojeIso.slice(0, 4)) - 1}${hojeIso.slice(4)}`;
}

/**
 * Tipos de serviço feitos LIMITE_REPETICAO vezes ou mais nos últimos 12
 * meses (de hoje, em Palmas, para trás), do mais frequente para o menos.
 */
export function servicosRepetidos(
  servicos: readonly { tipo: TipoServico; data_servico: string }[],
  hojeIso: string,
): { tipo: TipoServico; vezes: number }[] {
  const inicio = dozeMesesAntes(hojeIso);
  const contagem = new Map<TipoServico, number>();
  for (const s of servicos) {
    if (s.data_servico > inicio && s.data_servico <= hojeIso) {
      contagem.set(s.tipo, (contagem.get(s.tipo) ?? 0) + 1);
    }
  }
  return [...contagem]
    .filter(([, vezes]) => vezes >= LIMITE_REPETICAO)
    .map(([tipo, vezes]) => ({ tipo, vezes }))
    .sort((a, b) => b.vezes - a.vezes);
}
