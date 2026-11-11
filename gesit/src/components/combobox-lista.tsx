"use client";

import { cn } from "cn";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type OpcaoLista = {
  value: string;
  /** Texto do botão e da lista. */
  label: string;
  /** Linha secundária na lista (ex.: cidade da loja). */
  descricao?: string;
  /** Texto extra que também casa com a busca, além de label e descrição. */
  termos?: string;
};

type Props = {
  id?: string;
  opcoes: readonly OpcaoLista[];
  /** value da opção selecionada; vazio = nenhuma. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  placeholderBusca?: string;
  vazio?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  /** Nome acessível quando não há <Label htmlFor>. */
  ariaLabel?: string;
  /** id da mensagem de erro do campo (aria-describedby). */
  descritoPor?: string;
  className?: string;
  /** react-hook-form: foca o campo com erro ao enviar. */
  ref?: Ref<HTMLButtonElement>;
  onBlur?: () => void;
};

/** Minúsculas e sem acento: "Gurupi" e "gurupí" casam. */
export function normalizarBusca(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Filtra por qualquer parte do texto. Ordem: começa pelo termo, depois uma
 * palavra que começa pelo termo, depois o resto (mantendo a ordem original).
 */
function filtrar(opcoes: readonly OpcaoLista[], termo: string) {
  const t = normalizarBusca(termo);
  if (!t) return [...opcoes];
  const comPeso = opcoes.flatMap((o) => {
    const texto = normalizarBusca(`${o.label} ${o.descricao ?? ""} ${o.termos ?? ""}`);
    const pos = texto.indexOf(t);
    if (pos < 0) return [];
    const peso = pos === 0 ? 0 : /[\s(·,/-]/.test(texto[pos - 1]) ? 1 : 2;
    return [{ o, peso }];
  });
  return comPeso.sort((a, b) => a.peso - b.peso).map(({ o }) => o);
}

/**
 * Select com busca pelo teclado numa lista já carregada (sem ir ao servidor).
 * Digitar com o botão focado já abre a lista filtrando; setas navegam e
 * Enter escolhe o resultado destacado (o primeiro, de início).
 */
export function ComboboxLista({
  id,
  opcoes,
  value,
  onChange,
  placeholder = "Selecione",
  placeholderBusca = "Buscar...",
  vazio = "Nenhum resultado.",
  disabled,
  invalid,
  required,
  ariaLabel,
  descritoPor,
  className,
  ref,
  onBlur,
}: Props) {
  const listaId = useId();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [ativo, setAtivo] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  const selecionada = opcoes.find((o) => o.value === value);
  const itens = useMemo(() => filtrar(opcoes, texto), [opcoes, texto]);

  function abrir(next: boolean, inicial = "") {
    setOpen(next);
    setTexto(inicial);
    // Ao abrir sem texto, começa na opção selecionada.
    const atual = inicial ? -1 : opcoes.findIndex((o) => o.value === value);
    setAtivo(Math.max(atual, 0));
  }

  function escolher(opcao: OpcaoLista) {
    onChange(opcao.value);
    abrir(false);
  }

  function mover(para: number) {
    const novo = Math.min(Math.max(para, 0), itens.length - 1);
    setAtivo(novo);
    listaRef.current
      ?.querySelector(`[data-indice="${novo}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDownBusca(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      mover(ativo + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      mover(ativo - 1);
    } else if (e.key === "Home" && !texto) {
      e.preventDefault();
      mover(0);
    } else if (e.key === "End" && !texto) {
      e.preventDefault();
      mover(itens.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opcao = itens[ativo];
      if (opcao) escolher(opcao);
    } else if (e.key === "Tab") {
      abrir(false);
    }
  }

  /** Com o botão focado: letra abre já filtrando; setas abrem a lista. */
  function onKeyDownBotao(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1 && e.key !== " ") {
      e.preventDefault();
      abrir(true, e.key);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      abrir(true);
    }
  }

  const ativoId = itens[ativo] ? `${listaId}-${ativo}` : undefined;

  return (
    <Popover open={open} onOpenChange={(next) => abrir(next)} modal>
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
          aria-label={ariaLabel}
          aria-invalid={invalid}
          aria-required={required || undefined}
          aria-describedby={descritoPor}
          disabled={disabled}
          onKeyDown={onKeyDownBotao}
          onBlur={onBlur}
          className={cn("h-8 w-full justify-between px-2.5 font-normal", className)}
        >
          <span className={cn("truncate text-left", !selecionada && "text-muted-foreground")}>
            {selecionada?.label ?? placeholder}
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-60 gap-0 p-0"
      >
        <div className="flex items-center gap-2 border-b px-2.5">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            type="text"
            role="combobox"
            aria-label={placeholderBusca}
            aria-expanded
            aria-autocomplete="list"
            aria-controls={listaId}
            aria-activedescendant={ativoId}
            value={texto}
            // Aberto por uma letra: o cursor fica depois dela.
            onFocus={(e) => e.currentTarget.setSelectionRange(texto.length, texto.length)}
            onChange={(e) => {
              setTexto(e.target.value);
              setAtivo(0);
              listaRef.current?.scrollTo({ top: 0 });
            }}
            onKeyDown={onKeyDownBusca}
            placeholder={placeholderBusca}
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          ref={listaRef}
          id={listaId}
          role="listbox"
          className="max-h-64 overflow-y-auto p-1"
        >
          {itens.length === 0 && (
            <p role="status" className="px-2 py-3 text-center text-sm text-muted-foreground">
              {vazio}
            </p>
          )}
          {itens.map((o, i) => {
            const marcada = o.value === value;
            return (
              <div
                key={o.value}
                id={`${listaId}-${i}`}
                data-indice={i}
                role="option"
                aria-selected={marcada}
                onMouseEnter={() => setAtivo(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(o)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                  i === ativo && "bg-accent text-accent-foreground",
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
                {marcada && <CheckIcon className="size-4 shrink-0" aria-hidden />}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
