import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import {
  SITUACAO_VIDA_UTIL_LABEL,
  paraSituacaoVidaUtil,
  type SituacaoVidaUtil,
} from "@/lib/types";

const CORES: Record<SituacaoVidaUtil, string> = {
  // Verde da marca no fundo; texto no verde escuro (AA).
  ok: "bg-brand-green/15 text-brand-green-strong dark:bg-brand-green/20",
  proximo: "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400",
  vencido: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  sem_data: "bg-muted text-muted-foreground",
  baixado: "bg-muted text-muted-foreground",
};

/**
 * Situação da vida útil (coluna situacao_vida_util da vw_dispositivos).
 * Baixados ficam fora dos alertas: mostra só um traço.
 */
export function VidaUtilBadge({ situacao }: { situacao: string | null }) {
  const s = paraSituacaoVidaUtil(situacao);
  if (!s || s === "baixado") return <span className="text-muted-foreground">—</span>;
  return (
    <Badge className={cn("border-transparent", CORES[s])}>{SITUACAO_VIDA_UTIL_LABEL[s]}</Badge>
  );
}
