import { cn } from "cn";
import { ArrowDownIcon, ArrowUpIcon, EqualIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CLASSES_COR, PRIORIDADE_COR, PRIORIDADE_LABEL } from "@/lib/atividades";
import type { CorKanban, PrioridadeAtividade } from "@/lib/types";

/** Etiqueta colorida (categoria). A cor nunca vem sozinha: o nome está no texto. */
export function Etiqueta({
  cor,
  children,
  className,
}: {
  cor: CorKanban;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 truncate rounded-md px-1.5 text-xs font-medium",
        CLASSES_COR[cor].etiqueta,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Quadradinho pastel que identifica a cor da coluna em listas e menus. */
export function AmostraCor({ cor, className }: { cor: CorKanban; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-sm border", CLASSES_COR[cor].amostra, className)}
    />
  );
}

const ICONE_PRIORIDADE = { alta: ArrowUpIcon, media: EqualIcon, baixa: ArrowDownIcon } as const;

/** Selo de prioridade: cor + ícone + texto. */
export function SeloPrioridade({ prioridade }: { prioridade: PrioridadeAtividade }) {
  const Icone = ICONE_PRIORIDADE[prioridade];
  return (
    <Etiqueta cor={PRIORIDADE_COR[prioridade]}>
      <Icone aria-hidden className="size-3" />
      <span>
        <span className="sr-only">Prioridade </span>
        {PRIORIDADE_LABEL[prioridade]}
      </span>
    </Etiqueta>
  );
}
