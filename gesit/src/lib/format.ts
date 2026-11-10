const formatadorDataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  // Fuso de Palmas/TO (UTC−3, sem horário de verão).
  timeZone: "America/Araguaina",
});

/** Ex.: "10/11/2026, 14:32". */
export function formatarDataHora(iso: string): string {
  return formatadorDataHora.format(new Date(iso));
}
