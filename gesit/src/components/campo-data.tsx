"use client";

import { cn } from "cn";
import { CalendarIcon } from "lucide-react";
import { useRef, useState, type Ref } from "react";
import { ptBR } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hojeEmPalmas } from "@/lib/format";

type Props = {
  id?: string;
  /** "AAAA-MM-DD" ou vazio. Nos formulários pode vir o texto inválido digitado. */
  value: string;
  /**
   * Recebe "AAAA-MM-DD" quando a data digitada ou escolhida é válida e ""
   * quando o campo é limpo. Com `emitirInvalido`, um texto incompleto ou
   * inválido também é repassado (para a validação do formulário acusar);
   * sem ele, o texto fica só no campo e volta ao valor anterior ao sair.
   */
  onChange: (valor: string) => void;
  emitirInvalido?: boolean;
  /** Limites do calendário ("AAAA-MM-DD"). A validação fica com quem usa. */
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  ariaLabel?: string;
  descritoPor?: string;
  className?: string;
  name?: string;
  ref?: Ref<HTMLInputElement>;
  onBlur?: () => void;
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "AAAA-MM-DD" → Date local (meia-noite), ou undefined se não for data real. */
function paraDate(iso: string | undefined): Date | undefined {
  const m = iso ? ISO.exec(iso) : null;
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : undefined;
}

function paraISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "AAAA-MM-DD" → "dd/mm/aaaa"; outro texto volta como veio. */
function paraTexto(valor: string): string {
  const m = ISO.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

/** Máscara enquanto digita: só dígitos, com as barras no lugar. */
function mascarar(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "dd/mm/aaaa" completo e real → "AAAA-MM-DD"; senão null. */
function lerTexto(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m || Number(m[3]) < 1900) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return paraDate(iso) ? iso : null;
}

/**
 * Campo de data em pt-BR (dd/mm/aaaa): digitação com máscara ou escolha no
 * calendário (meses e dias da semana em português, semana começando no
 * domingo). O valor trafega sempre como "AAAA-MM-DD".
 */
export function CampoData({
  id,
  value,
  onChange,
  emitirInvalido = false,
  min,
  max,
  disabled,
  invalid,
  required,
  ariaLabel,
  descritoPor,
  className,
  name,
  ref,
  onBlur,
}: Props) {
  const [aberto, setAberto] = useState(false);
  /** Texto digitado que ainda não é uma data (só sem emitirInvalido). */
  const [rascunho, setRascunho] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selecionada = paraDate(value);
  const minimo = paraDate(min);
  const maximo = paraDate(max);
  const hoje = paraDate(hojeEmPalmas())!;
  const anoAtual = hoje.getFullYear();

  function digitar(bruto: string) {
    const texto = mascarar(bruto);
    const iso = lerTexto(texto);
    if (iso !== null || texto === "") {
      setRascunho(null);
      onChange(iso ?? "");
    } else if (emitirInvalido) {
      setRascunho(null);
      onChange(texto);
    } else {
      setRascunho(texto);
    }
  }

  function escolher(data: Date | undefined) {
    if (!data) return;
    setRascunho(null);
    onChange(paraISO(data));
    setAberto(false);
    inputRef.current?.focus();
  }

  // Mês aberto no calendário: o da data escolhida, senão hoje dentro dos limites.
  let mesInicial = selecionada ?? hoje;
  if (!selecionada && maximo && mesInicial > maximo) mesInicial = maximo;
  if (!selecionada && minimo && mesInicial < minimo) mesInicial = minimo;

  const desabilitados = [
    ...(minimo ? [{ before: minimo }] : []),
    ...(maximo ? [{ after: maximo }] : []),
  ];

  return (
    <Popover open={aberto} onOpenChange={setAberto} modal>
      <PopoverAnchor asChild>
        <div className={cn("relative w-full", className)}>
          <input
            id={id}
            name={name}
            ref={(el) => {
              inputRef.current = el;
              if (typeof ref === "function") ref(el);
              else if (ref) ref.current = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            maxLength={10}
            value={rascunho ?? paraTexto(value)}
            onChange={(e) => digitar(e.target.value)}
            onBlur={() => {
              setRascunho(null); // texto incompleto (filtros) volta ao valor atual
              onBlur?.();
            }}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-invalid={invalid}
            aria-required={required || undefined}
            aria-describedby={descritoPor}
            data-slot="input"
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-9 pl-2.5 text-base tabular-nums transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label="Abrir calendário"
              className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
            >
              <CalendarIcon />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={ptBR}
          weekStartsOn={0}
          captionLayout="dropdown"
          startMonth={minimo ?? new Date(anoAtual - 30, 0)}
          endMonth={maximo ?? new Date(anoAtual + 15, 11)}
          defaultMonth={mesInicial}
          today={hoje}
          selected={selecionada}
          onSelect={escolher}
          disabled={desabilitados}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
