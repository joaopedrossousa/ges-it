import { formatDistanceStrict, formatDuration, intervalToDuration } from "date-fns";
import { ptBR } from "date-fns/locale";

const FUSO = "America/Araguaina"; // Palmas/TO (UTC−3, sem horário de verão)

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
export function formatarDataHora(iso: string): string {
  return formatadorDataHora.format(new Date(iso));
}

/** Ex.: "10/11/2026". */
export function formatarData(iso: string): string {
  return formatadorData.format(new Date(iso));
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
