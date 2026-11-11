import { CircleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Badge âmbar de usuário sem CPF e/ou sem e-mail. `detalhe` vem de
 * descreverPendencias (src/lib/colaboradores.ts); vazio = não mostra nada.
 */
export function DadosPendentesBadge({ detalhe }: { detalhe: string }) {
  if (!detalhe) return null;
  return (
    <Badge
      title={detalhe}
      className="border-transparent bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400"
    >
      <CircleAlertIcon aria-hidden />
      Dados pendentes
      <span className="sr-only">: {detalhe}</span>
    </Badge>
  );
}
