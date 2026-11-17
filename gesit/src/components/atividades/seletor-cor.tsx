"use client";

import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";

import { CLASSES_COR, COR_LABEL } from "@/lib/atividades";
import { CORES_KANBAN, type CorKanban } from "@/lib/types";

/**
 * Escolha da cor na paleta fixa (radiogroup: setas mudam a cor, Tab sai).
 * Cada opção mostra a amostra e tem o nome no rótulo acessível e no title.
 */
export function SeletorCor({
  value,
  onChange,
  idRotulo,
  disabled,
}: {
  value: CorKanban;
  onChange: (cor: CorKanban) => void;
  /** id do texto que rotula o grupo. */
  idRotulo: string;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const passo =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const novo = (i + passo + CORES_KANBAN.length) % CORES_KANBAN.length;
    onChange(CORES_KANBAN[novo]);
    refs.current[novo]?.focus();
  }

  return (
    <div role="radiogroup" aria-labelledby={idRotulo} className="flex flex-wrap gap-2">
      {CORES_KANBAN.map((cor, i) => {
        const marcada = cor === value;
        return (
          <button
            key={cor}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={marcada}
            aria-label={COR_LABEL[cor]}
            title={COR_LABEL[cor]}
            tabIndex={marcada ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(cor)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
              CLASSES_COR[cor].ponto,
              marcada && "ring-2 ring-foreground",
            )}
          >
            {marcada && <CheckIcon aria-hidden className="size-4 text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}
