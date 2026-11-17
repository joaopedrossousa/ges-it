"use client";

import { cn } from "cn";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon, XIcon } from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type Ref } from "react";

import { Etiqueta } from "@/components/atividades/etiquetas";
import { normalizarBusca } from "@/components/combobox-lista";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CategoriaKanban } from "@/lib/atividades";

type Props = {
  id?: string;
  /** Todas as categorias; inativas só aparecem se já estiverem marcadas. */
  categorias: CategoriaKanban[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  descritoPor?: string;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * Multisseleção de categorias com busca. Enter ou clique marca/desmarca e a
 * lista continua aberta; Esc fecha. As marcadas aparecem como etiquetas,
 * cada uma com botão para remover.
 */
export function CampoCategorias({
  id,
  categorias,
  value,
  onChange,
  disabled,
  invalid,
  descritoPor,
  ref,
}: Props) {
  const listaId = useId();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [ativo, setAtivo] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const marcadas = value.map((v) => porId.get(v)).filter((c): c is CategoriaKanban => Boolean(c));

  const opcoes = useMemo(() => {
    const t = normalizarBusca(texto);
    return categorias.filter(
      (c) => (c.ativa || value.includes(c.id)) && (!t || normalizarBusca(c.nome).includes(t)),
    );
  }, [categorias, texto, value]);

  function alternar(c: CategoriaKanban) {
    onChange(value.includes(c.id) ? value.filter((v) => v !== c.id) : [...value, c.id]);
  }

  function mover(para: number) {
    const novo = Math.min(Math.max(para, 0), opcoes.length - 1);
    setAtivo(novo);
    listaRef.current?.querySelector(`[data-indice="${novo}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      mover(ativo + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      mover(ativo - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = opcoes[ativo];
      if (c) alternar(c);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const ativoId = opcoes[ativo] ? `${listaId}-${ativo}` : undefined;

  return (
    <div className="grid gap-2">
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          setTexto("");
          setAtivo(0);
        }}
        modal
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listaId : undefined}
            aria-invalid={invalid}
            aria-describedby={descritoPor}
            disabled={disabled}
            className="h-8 w-full justify-between px-2.5 font-normal"
          >
            <span className={cn("truncate", marcadas.length === 0 && "text-muted-foreground")}>
              {marcadas.length === 0
                ? "Selecione as categorias"
                : marcadas.length === 1
                  ? "1 categoria selecionada"
                  : `${marcadas.length} categorias selecionadas`}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 gap-0 p-0">
          <div className="flex items-center gap-2 border-b px-2.5">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              type="text"
              role="combobox"
              aria-label="Buscar categoria"
              aria-expanded
              aria-autocomplete="list"
              aria-controls={listaId}
              aria-activedescendant={ativoId}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setAtivo(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Buscar categoria..."
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div
            ref={listaRef}
            id={listaId}
            role="listbox"
            aria-multiselectable
            aria-label="Categorias"
            className="max-h-64 overflow-y-auto p-1"
          >
            {opcoes.length === 0 && (
              <p role="status" className="px-2 py-3 text-center text-sm text-muted-foreground">
                Nenhuma categoria encontrada.
              </p>
            )}
            {opcoes.map((c, i) => {
              const marcada = value.includes(c.id);
              return (
                <div
                  key={c.id}
                  id={`${listaId}-${i}`}
                  data-indice={i}
                  role="option"
                  aria-selected={marcada}
                  onMouseEnter={() => setAtivo(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => alternar(c)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    i === ativo && "bg-accent text-accent-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      marcada ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {marcada && <CheckIcon className="size-3" />}
                  </span>
                  <Etiqueta cor={c.cor}>{c.nome}</Etiqueta>
                  {!c.ativa && <span className="text-xs text-muted-foreground">(inativa)</span>}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {marcadas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Categorias selecionadas">
          {marcadas.map((c) => (
            <li key={c.id}>
              <Etiqueta cor={c.cor} className="pr-0.5">
                {c.nome}
                <button
                  type="button"
                  onClick={() => alternar(c)}
                  disabled={disabled}
                  className="rounded p-0.5 outline-none hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/10"
                >
                  <XIcon aria-hidden className="size-3" />
                  <span className="sr-only">Remover {c.nome}</span>
                </button>
              </Etiqueta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
