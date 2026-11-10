import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const formatadorNumero = new Intl.NumberFormat("pt-BR");

type Props = {
  /** Rótulo em sentence case, sem dois-pontos. */
  rotulo: string;
  valor: number;
  icone: LucideIcon;
  /** Cor do ícone (status). O texto fica sempre nas cores de texto. */
  corIcone?: string;
  detalhe?: ReactNode;
  href: string;
};

/** Indicador clicável: rótulo, valor e detalhe. */
export function StatTile({ rotulo, valor, icone: Icone, corIcone, detalhe, href }: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-xl border bg-card p-4 text-card-foreground transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icone className={cn("size-4 shrink-0", corIcone)} aria-hidden />
        {rotulo}
      </span>
      <span className="text-3xl font-semibold tracking-tight">
        {formatadorNumero.format(valor)}
      </span>
      {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
    </Link>
  );
}

export function StatTileCarregando() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4" aria-hidden>
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      <div className="h-3 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}
