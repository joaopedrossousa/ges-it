import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { STATUS_DISPOSITIVO_LABEL, type StatusDispositivo } from "@/lib/types";

const CORES: Record<StatusDispositivo, string> = {
  disponivel:
    "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  em_uso: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
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
