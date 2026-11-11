import { PaperclipIcon } from "lucide-react";

/**
 * Abre o anexo do serviço em nova aba. O link aponta para /api/servicos/anexo,
 * que gera uma URL assinada de 60 s no momento do clique.
 */
export function LinkAnexoServico({ path }: { path: string | null }) {
  if (!path) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={`/api/servicos/anexo?path=${encodeURIComponent(path)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      <PaperclipIcon className="size-4" />
      Ver anexo
    </a>
  );
}
