"use client";

import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";

import { CLASSES_COR, COR_LABEL } from "@/lib/atividades";
import { CORES_KANBAN, type CorKanban } from "@/lib/types";

/**
 * Escolha da cor na paleta fixa (radiogroup: setas mudam a cor, Tab sai).
 * Cada opção é uma miniatura pastel da coluna (fundo + selo do título), com
 * borda própria: aparece mesmo que a cor não carregue. Nome no rótulo
 * acessível, no title e ao lado da pré-visualização.
 */
export function SeletorCor({
  value,
  onChange,
  idRotulo,
  disabled,
  previa,
}: {
  value: CorKanban;
  onChange: (cor: CorKanban) => void;
  /** id do texto que rotula o grupo. */
  idRotulo: string;
  disabled?: boolean;
  /** Com valor (mesmo vazio), mostra a coluna de exemplo com este nome no selo. */
  previa?: string;
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
    <div className="grid gap-3">
      <div role="radiogroup" aria-labelledby={idRotulo} className="grid grid-cols-5 gap-2">
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
                "relative flex h-10 cursor-pointer items-start rounded-md border p-1.5 outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                CLASSES_COR[cor].coluna,
                marcada && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
              )}
            >
              {/* Selo do título, no tom um pouco mais forte. */}
              <span
                aria-hidden
                className={cn("flex h-3.5 w-full items-center justify-center rounded-sm", CLASSES_COR[cor].etiqueta)}
              >
                {marcada && <CheckIcon className="size-3" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pré-visualização da coluna na cor escolhida, com um cartão neutro. */}
      {previa !== undefined && (
        <div aria-hidden className={cn("grid gap-2 rounded-lg border p-2", CLASSES_COR[value].coluna)}>
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate rounded-md px-1.5 py-0.5 text-xs font-semibold",
                CLASSES_COR[value].etiqueta,
              )}
            >
              {previa.trim() || "Coluna"}
            </span>
            <span className="text-xs text-muted-foreground">{COR_LABEL[value]}</span>
          </div>
          <div className="rounded-md border bg-cartao-kanban px-2 py-1.5 text-xs text-card-foreground shadow-xs">
            Atividade de exemplo
          </div>
        </div>
      )}
    </div>
  );
}
