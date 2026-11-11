import { formatDistanceStrict, formatDuration, intervalToDuration } from "date-fns";
import { ptBR } from "date-fns/locale";

export const FUSO = "America/Araguaina"; // Palmas/TO (UTC−3, sem horário de verão)

const formatadorDataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: FUSO,
});

const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: FUSO,
});

/** Ex.: "10/11/2026, 14:32". */
export function formatarDataHora(data: string | Date): string {
  return formatadorDataHora.format(new Date(data));
}

/** Ex.: "10/11/2026". */
export function formatarData(data: string | Date): string {
  return formatadorData.format(new Date(data));
}

const formatadorPartes = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: FUSO,
});

/**
 * Mesmo relógio de Palmas, gravado nos campos UTC. Para o Excel, que não
 * tem fuso: a célula mostra a hora de Palmas, não a do servidor (UTC).
 */
export function paraRelogioDePalmas(data: Date): Date {
  const p = Object.fromEntries(
    formatadorPartes.formatToParts(data).map(({ type, value }) => [type, Number(value)]),
  );
  return new Date(
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, data.getUTCMilliseconds()),
  );
}

/** Data de hoje em Palmas, como "AAAA-MM-DD". */
export function hojeEmPalmas(agora = new Date()): string {
  return paraRelogioDePalmas(agora).toISOString().slice(0, 10);
}

/**
 * Duração entre duas datas em pt-BR. Ex.: "1 ano, 3 meses, 5 dias";
 * abaixo de um dia: "4 horas", "12 minutos".
 */
export function formatarDuracao(inicioIso: string, fim: Date): string {
  const inicio = new Date(inicioIso);
  const texto = formatDuration(intervalToDuration({ start: inicio, end: fim }), {
    format: ["years", "months", "days"],
    locale: ptBR,
    delimiter: ", ",
  });
  return texto || formatDistanceStrict(inicio, fim, { locale: ptBR });
}
