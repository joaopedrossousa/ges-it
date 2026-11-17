import { cn } from "cn";
import {
  TriangleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import type { ResumoLancamentos, Total } from "@/lib/financeiro";
import { formatarMoeda } from "@/lib/format";

function Cartao({
  rotulo,
  total,
  icone: Icone,
  corIcone,
}: {
  rotulo: string;
  total: Total;
  icone: LucideIcon;
  corIcone?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-card-foreground">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icone className={cn("size-4 shrink-0", corIcone)} aria-hidden />
        {rotulo}
      </span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {formatarMoeda(total.valor)}
      </span>
      <span className="text-xs text-muted-foreground">
        {total.quantidade === 1 ? "1 lançamento" : `${total.quantidade} lançamentos`}
      </span>
    </div>
  );
}

/** Total do mês, pago, em aberto e vencido (cancelados ficam fora). */
export function ResumoMes({ resumo }: { resumo: ResumoLancamentos }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Cartao rotulo="Total do Mês" total={resumo.total} icone={WalletIcon} corIcone="text-brand-blue" />
      <Cartao rotulo="Pago" total={resumo.pago} icone={CircleCheckIcon} corIcone="text-brand-green" />
      <Cartao rotulo="Em Aberto" total={resumo.aberto} icone={ClockIcon} corIcone="text-amber-600" />
      <Cartao
        rotulo="Vencido"
        total={resumo.vencido}
        icone={TriangleAlertIcon}
        corIcone="text-destructive"
      />
    </div>
  );
}

export function ResumoMesCarregando() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
