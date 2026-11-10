"use client";

import { cn } from "cn";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type OpcaoCombobox = {
  value: string;
  /** Texto principal (aparece no botão quando selecionado). */
  label: string;
  /** Linha secundária na lista. */
  descricao?: ReactNode;
  /** Texto extra considerado na busca (ex.: IMEI só com dígitos). */
  busca?: string;
};

type Props = {
  id?: string;
  opcoes: OpcaoCombobox[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  placeholderBusca?: string;
  vazio?: string;
  disabled?: boolean;
  invalid?: boolean;
  maxResultados?: number;
};

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Select com busca (popover + listbox), navegável por teclado. */
export function Combobox({
  id,
  opcoes,
  value,
  onChange,
  placeholder,
  placeholderBusca = "Buscar...",
  vazio = "Nenhum resultado.",
  disabled,
  invalid,
  maxResultados = 50,
}: Props) {
  const listaId = useId();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return opcoes;
    return opcoes.filter((o) =>
      normalizar(`${o.label} ${o.busca ?? ""}`).includes(termo),
    );
  }, [busca, opcoes]);
  const visiveis = filtradas.slice(0, maxResultados);
  const selecionada = opcoes.find((o) => o.value === value);

  function abrir(next: boolean) {
    setOpen(next);
    if (next) {
      setBusca("");
      const indice = opcoes.findIndex((o) => o.value === value);
      setAtivo(indice >= 0 && indice < maxResultados ? indice : 0);
    }
  }

  function escolher(opcao: OpcaoCombobox) {
    onChange(opcao.value);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, visiveis.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opcao = visiveis[ativo];
      if (opcao) escolher(opcao);
    }
  }

  return (
    <Popover open={open} onOpenChange={abrir} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listaId}
          aria-invalid={invalid}
          disabled={disabled}
          className="h-auto min-h-8 w-full justify-between py-1.5 font-normal"
        >
          <span
            className={cn("truncate text-left", !selecionada && "text-muted-foreground")}
          >
            {selecionada?.label ?? placeholder}
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-72 p-0"
      >
        <div className="flex items-center gap-2 border-b px-2.5">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            role="searchbox"
            aria-controls={listaId}
            aria-activedescendant={
              visiveis[ativo] ? `${listaId}-${visiveis[ativo].value}` : undefined
            }
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAtivo(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholderBusca}
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div id={listaId} role="listbox" className="max-h-64 overflow-y-auto p-1">
          {visiveis.length === 0 && (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">{vazio}</p>
          )}
          {visiveis.map((o, i) => {
            const selecionado = o.value === value;
            return (
              <div
                key={o.value}
                id={`${listaId}-${o.value}`}
                role="option"
                aria-selected={selecionado}
                onMouseEnter={() => setAtivo(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(o)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                  i === ativo && "bg-muted",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.descricao && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.descricao}
                    </span>
                  )}
                </span>
                {selecionado && <CheckIcon className="size-4 shrink-0" />}
              </div>
            );
          })}
          {filtradas.length > maxResultados && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Mostrando {maxResultados} de {filtradas.length}. Refine a busca.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
