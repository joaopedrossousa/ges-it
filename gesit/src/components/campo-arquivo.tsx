"use client";

import { cn } from "cn";
import { FileIcon, XIcon } from "lucide-react";
import { useId, useRef } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  /** id do input (para o <Label htmlFor>: clicar no rótulo abre a escolha). */
  id: string;
  accept: string;
  /** Arquivo escolhido (o pai guarda e valida). */
  arquivo: File | null;
  /** Arquivo escolhido na janela do sistema, ou null ao clicar em Remover. */
  onChange: (arquivo: File | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** id da ajuda/erro do campo (aria-describedby). */
  descritoPor?: string;
};

/**
 * Campo de arquivo em português: nome do arquivo (ou "Nenhum arquivo
 * selecionado") à esquerda e o botão "Escolher arquivo" à direita; depois de
 * escolher, o botão vira "Remover". O <input type="file"> fica escondido.
 */
export function CampoArquivo({
  id,
  accept,
  arquivo,
  onChange,
  disabled,
  invalid,
  descritoPor,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  // O botão troca (Escolher ↔ Remover): o foco segue para o novo.
  const focarBotao = () => requestAnimationFrame(() => botaoRef.current?.focus());
  const nomeId = useId();
  const descricao = [nomeId, descritoPor].filter(Boolean).join(" ");

  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-lg border border-input py-1 pr-1 pl-2.5 text-sm dark:bg-input/30",
        invalid && "border-destructive ring-3 ring-destructive/20",
        disabled && "opacity-50",
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        tabIndex={-1}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const escolhido = e.target.files?.[0] ?? null;
          // Limpa o input: escolher o mesmo arquivo de novo dispara onChange.
          e.target.value = "";
          if (escolhido) {
            onChange(escolhido);
            focarBotao();
          }
        }}
      />
      <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span
        id={nomeId}
        className={cn("min-w-0 flex-1 truncate", !arquivo && "text-muted-foreground")}
        title={arquivo?.name}
      >
        {arquivo ? arquivo.name : "Nenhum arquivo selecionado"}
      </span>
      {arquivo ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          ref={botaoRef}
          aria-label={`Remover ${arquivo.name}`}
          onClick={() => {
            onChange(null);
            focarBotao();
          }}
        >
          <XIcon />
          Remover
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          ref={botaoRef}
          aria-invalid={invalid}
          aria-describedby={descricao}
          onClick={() => inputRef.current?.click()}
        >
          Escolher arquivo
        </Button>
      )}
    </div>
  );
}
