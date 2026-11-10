import { FileTextIcon } from "lucide-react";

/**
 * Abre o termo em nova aba. O link aponta para /api/termos, que gera uma URL
 * assinada de 60 s no momento do clique (o link da página nunca expira).
 */
export function LinkTermo({ path }: { path: string | null }) {
  if (!path) return <span className="text-muted-foreground">Sem termo</span>;
  return (
    <a
      href={`/api/termos?path=${encodeURIComponent(path)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      <FileTextIcon className="size-4" />
      Ver termo
    </a>
  );
}
