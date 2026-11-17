import { PaperclipIcon } from "lucide-react";

/**
 * Abre o boleto/NF do lançamento em nova aba. O link aponta para
 * /api/financeiro/anexo, que gera uma URL assinada de 60 s no clique.
 * `compacto`: só o ícone (tabela), com o texto para leitores de tela.
 */
export function LinkAnexoLancamento({
  path,
  compacto = false,
}: {
  path: string | null;
  compacto?: boolean;
}) {
  if (!path) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={`/api/financeiro/anexo?path=${encodeURIComponent(path)}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Ver anexo"
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      <PaperclipIcon className="size-4" />
      {compacto ? <span className="sr-only">Ver anexo</span> : "Ver anexo"}
    </a>
  );
}
