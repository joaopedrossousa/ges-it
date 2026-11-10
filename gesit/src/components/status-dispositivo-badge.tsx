import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { STATUS_DISPOSITIVO_LABEL, type StatusDispositivo } from "@/lib/types";

const CORES: Record<StatusDispositivo, string> = {
  // Verde da marca no fundo; texto no verde escuro (AA).
  disponivel: "bg-brand-green/15 text-brand-green-strong dark:bg-brand-green/20",
  em_uso: "bg-brand-blue/10 text-brand-blue dark:bg-primary/20 dark:text-primary",
  manutencao:
    "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400",
  baixado: "bg-muted text-muted-foreground line-through decoration-1",
};

export function StatusDispositivoBadge({
  status,
}: {
  status: StatusDispositivo | null;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge className={cn("border-transparent", CORES[status])}>
      {STATUS_DISPOSITIVO_LABEL[status]}
    </Badge>
  );
}
