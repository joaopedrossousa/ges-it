/** Placeholder exibido enquanto uma tabela carrega. */
export function TabelaCarregando({
  colunas,
  linhas = 5,
}: {
  colunas: number;
  linhas?: number;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      role="status"
      aria-label="Carregando..."
    >
      <div className="grid gap-3">
        {Array.from({ length: linhas }, (_, i) => (
          <div
            key={i}
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: colunas }, (_, j) => (
              <div key={j} className="h-4 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
