"use client";

import { cn } from "cn";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type ItemGaleria = {
  chave: string;
  nome: string;
  /** Imagem: miniatura e ampliação; PDF: ícone e abre em nova aba. */
  tipo: "imagem" | "pdf";
  /** blob: (arquivo local) ou rota que redireciona para URL assinada. */
  url: string;
};

type Props = {
  itens: ItemGaleria[];
  /** Presente no formulário: mostra o botão de remover em cada item. */
  onRemover?: (chave: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Miniaturas de anexos. Clicar numa imagem abre a visualização ampliada
 * (setas ou teclado navegam entre as imagens); um PDF abre em nova aba.
 */
export function GaleriaAnexos({ itens, onRemover, disabled, className }: Props) {
  const imagens = itens.filter((i) => i.tipo === "imagem");
  const [aberta, setAberta] = useState<number | null>(null);
  const atual = aberta !== null ? imagens[aberta] : undefined;

  function passo(delta: number) {
    if (aberta === null || imagens.length === 0) return;
    setAberta((aberta + delta + imagens.length) % imagens.length);
  }

  if (itens.length === 0) return null;

  return (
    <>
      <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Anexos">
        {itens.map((item) => (
          <li key={item.chave} className="group relative w-24">
            {item.tipo === "imagem" ? (
              <button
                type="button"
                onClick={() => setAberta(imagens.findIndex((i) => i.chave === item.chave))}
                className="block size-24 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`Ampliar ${item.nome}`}
              >
                {/* blob: e URLs assinadas: o otimizador do next/image não se aplica. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="size-full object-cover" />
              </button>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border bg-muted text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`Abrir ${item.nome} em nova aba`}
              >
                <FileTextIcon className="size-7 text-brand-blue dark:text-primary" aria-hidden />
                PDF
              </a>
            )}
            <span className="mt-1 block truncate text-xs" title={item.nome}>
              {item.nome}
            </span>
            {onRemover && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={disabled}
                onClick={() => onRemover(item.chave)}
                className="absolute -top-2 -right-2 size-6 rounded-full border shadow-sm"
                aria-label={`Remover ${item.nome}`}
              >
                <XIcon className="size-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={atual !== undefined} onOpenChange={(abrir) => !abrir && setAberta(null)}>
        <DialogContent
          className="sm:max-w-4xl"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") passo(1);
            if (e.key === "ArrowLeft") passo(-1);
          }}
        >
          {atual && (
            <>
              <DialogTitle className="truncate pr-8">{atual.nome}</DialogTitle>
              <DialogDescription className="sr-only">
                Imagem {(aberta ?? 0) + 1} de {imagens.length}. Use as setas para navegar.
              </DialogDescription>
              <div className="flex items-center justify-center rounded-lg bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={atual.url}
                  alt={atual.nome}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={atual.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon />
                    Abrir em nova aba
                  </a>
                </Button>
                {imagens.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => passo(-1)}>
                      <ChevronLeftIcon />
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {(aberta ?? 0) + 1} de {imagens.length}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => passo(1)}>
                      Próxima
                      <ChevronRightIcon />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
