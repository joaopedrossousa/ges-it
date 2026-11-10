"use client";

import { cn } from "cn";
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon, SearchIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MINIMO_BUSCA } from "@/lib/busca";

export type OpcaoCombobox<T> = {
  value: string;
  /** Texto principal (aparece no botão quando selecionado). */
  label: string;
  /** Linha secundária na lista. */
  descricao?: ReactNode;
  /** Objeto completo, devolvido em onChange. */
  dados: T;
};

type Estado<T> =
  | { tipo: "ocioso" }
  | { tipo: "carregando" }
  | { tipo: "pronto"; itens: OpcaoCombobox<T>[] }
  | { tipo: "erro"; mensagem: string };

type Props<T> = {
  id?: string;
  /** Opção selecionada (o pai guarda o objeto inteiro). */
  value: OpcaoCombobox<T> | null;
  onChange: (opcao: OpcaoCombobox<T>) => void;
  /** Busca no servidor; recebe o texto e um AbortSignal. */
  buscar: (termo: string, signal: AbortSignal) => Promise<OpcaoCombobox<T>[]>;
  placeholder: string;
  placeholderBusca?: string;
  vazio?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** id da mensagem de erro do campo (aria-describedby). */
  descritoPor?: string;
  atraso?: number;
};

/**
 * Select com busca no servidor: consulta a partir de MINIMO_BUSCA caracteres,
 * com atraso entre teclas e cancelamento da busca anterior.
 */
export function ComboboxBusca<T>({
  id,
  value,
  onChange,
  buscar,
  placeholder,
  placeholderBusca = "Buscar...",
  vazio = "Nenhum resultado.",
  disabled,
  invalid,
  descritoPor,
  atraso = 250,
}: Props<T>) {
  const listaId = useId();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<Estado<T>>({ tipo: "ocioso" });
  const [ativo, setAtivo] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controle = useRef<AbortController | null>(null);

  function cancelarPendentes() {
    if (timer.current) clearTimeout(timer.current);
    controle.current?.abort();
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      controle.current?.abort();
    },
    [],
  );

  const itens = estado.tipo === "pronto" ? estado.itens : [];

  function abrir(next: boolean) {
    setOpen(next);
    if (!next) cancelarPendentes();
    setTexto("");
    setEstado({ tipo: "ocioso" });
    setAtivo(0);
  }

  function aoDigitar(novo: string) {
    setTexto(novo);
    setAtivo(0);
    cancelarPendentes();

    const termo = novo.trim();
    if (termo.length < MINIMO_BUSCA) {
      setEstado({ tipo: "ocioso" });
      return;
    }

    setEstado({ tipo: "carregando" });
    timer.current = setTimeout(async () => {
      const ac = new AbortController();
      controle.current = ac;
      try {
        const resultado = await buscar(termo, ac.signal);
        if (!ac.signal.aborted) setEstado({ tipo: "pronto", itens: resultado });
      } catch (e) {
        if (ac.signal.aborted) return;
        setEstado({
          tipo: "erro",
          mensagem: e instanceof Error ? e.message : "Não foi possível buscar.",
        });
      }
    }, atraso);
  }

  function escolher(opcao: OpcaoCombobox<T>) {
    onChange(opcao);
    abrir(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, itens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opcao = itens[ativo];
      if (opcao) escolher(opcao);
    }
  }

  let mensagem: ReactNode = null;
  if (estado.tipo === "ocioso") {
    mensagem = `Digite ao menos ${MINIMO_BUSCA} caracteres para buscar.`;
  } else if (estado.tipo === "carregando") {
    mensagem = (
      <span className="inline-flex items-center gap-2">
        <Loader2Icon className="size-4 animate-spin" /> Buscando...
      </span>
    );
  } else if (estado.tipo === "erro") {
    mensagem = <span className="text-destructive">{estado.mensagem}</span>;
  } else if (itens.length === 0) {
    mensagem = vazio;
  }

  return (
    <Popover open={open} onOpenChange={abrir} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={invalid}
          aria-describedby={descritoPor}
          disabled={disabled}
          className="h-auto min-h-8 w-full justify-between py-1.5 font-normal"
        >
          <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
            {value?.label ?? placeholder}
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <div className="flex items-center gap-2 border-b px-2.5">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            role="combobox"
            aria-label={placeholderBusca}
            aria-expanded
            aria-autocomplete="list"
            aria-controls={listaId}
            aria-activedescendant={itens[ativo] ? `${listaId}-${itens[ativo].value}` : undefined}
            value={texto}
            onChange={(e) => aoDigitar(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholderBusca}
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          id={listaId}
          role="listbox"
          aria-busy={estado.tipo === "carregando"}
          className="max-h-64 overflow-y-auto p-1"
        >
          {mensagem && (
            <p role="status" className="px-2 py-3 text-center text-sm text-muted-foreground">
              {mensagem}
            </p>
          )}
          {itens.map((o, i) => {
            const selecionado = o.value === value?.value;
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
