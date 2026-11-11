import { ReceiptIcon } from "lucide-react";

/**
 * Abre a nota fiscal em nova aba. O link aponta para /api/notas-fiscais, que
 * gera uma URL assinada de 60 s no momento do clique.
 */
export function LinkNotaFiscal({ path }: { path: string | null }) {
  if (!path) return <span className="text-muted-foreground">Sem nota fiscal</span>;
  return (
    <a
      href={`/api/notas-fiscais?path=${encodeURIComponent(path)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      <ReceiptIcon className="size-4" />
      Ver nota fiscal
    </a>
  );
}
