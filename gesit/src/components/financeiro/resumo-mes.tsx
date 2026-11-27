import { cn } from "cn";
import {
  CircleCheckIcon,
  ClockIcon,
  HourglassIcon,
  TriangleAlertIcon,
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
  extra,
}: {
  rotulo: string;
  total: Total;
  icone: LucideIcon;
  corIcone?: string;
  /** Linha a mais embaixo (ex.: comparação com o mês anterior). */
  extra?: string;
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
        {extra && <span className="block font-medium text-foreground/80 tabular-nums">{extra}</span>}
      </span>
    </div>
  );
}

/**
 * Total do mês, pago, em aberto e vencido (cancelados ficam fora). Com
 * `comAprovacao`, também "Aguardando Aprovação" (Painel). `comparacao`:
 * texto sob o total (ex.: "+7% vs outubro").
 */
export function ResumoMes({
  resumo,
  comAprovacao = false,
  comparacao,
}: {
  resumo: ResumoLancamentos;
  comAprovacao?: boolean;
  comparacao?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        comAprovacao ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      <Cartao
        rotulo="Total do Mês"
        total={resumo.total}
        icone={WalletIcon}
        corIcone="text-brand-blue dark:text-primary"
        extra={comparacao}
      />
      <Cartao rotulo="Pago" total={resumo.pago} icone={CircleCheckIcon} corIcone="text-brand-green" />
      <Cartao rotulo="Em Aberto" total={resumo.aberto} icone={ClockIcon} corIcone="text-amber-600 dark:text-amber-400" />
      <Cartao
        rotulo="Vencido"
        total={resumo.vencido}
        icone={TriangleAlertIcon}
        corIcone="text-destructive"
      />
      {comAprovacao && (
        <Cartao
          rotulo="Aguardando Aprovação"
          total={resumo.aguardando}
          icone={HourglassIcon}
          corIcone="text-muted-foreground"
        />
      )}
    </div>
  );
}

export function ResumoMesCarregando({ cartoes = 4 }: { cartoes?: number }) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        cartoes === 5 ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4",
      )}
      aria-hidden
    >
      {Array.from({ length: cartoes }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
