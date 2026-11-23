"use client";

import { cn } from "cn";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  XIcon,
} from "lucide-react";
import { useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type ItemGaleria = {
  chave: string;
  /** Texto principal (nome do arquivo ou legenda). */
  nome: string;
  /** Imagem: miniatura e ampliação; PDF: ícone e abre em nova aba. */
  tipo: "imagem" | "pdf";
  /** blob: (arquivo local), URL assinada ou rota que redireciona para uma URL assinada. */
  url: string;
  /** Versão reduzida para a miniatura (sem ela, a miniatura usa `url`). */
  miniatura?: string;
  /**
   * Rota que gera uma URL assinada nova a cada pedido: usada se `url` (ou a
   * miniatura) falhar, ex.: URL assinada expirada, e no "Abrir em nova aba".
   */
  reserva?: string;
  /** Linha secundária (ex.: data e autor). */
  detalhe?: string;
  /** Legenda editável (com `onLegenda`). */
  legenda?: string;
};

type Props = {
  itens: ItemGaleria[];
  /** Mostra o botão de remover em cada item (o chamador decide se confirma). */
  onRemover?: (chave: string) => void;
  /** Mostra um campo de legenda abaixo de cada item. */
  onLegenda?: (chave: string, legenda: string) => void;
  /** sm: 96 px (anexos); md: 144 px (imagens do item, com legenda). */
  tamanho?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  /** Rótulo da lista para leitores de tela. */
  rotulo?: string;
};

/**
 * Se a imagem falhar, tenta a próxima fonte (miniatura → url → reserva), uma
 * vez cada. O índice da tentativa fica no próprio elemento.
 */
function tentarProxima(e: SyntheticEvent<HTMLImageElement>, fontes: (string | undefined)[]) {
  const img = e.currentTarget;
  const lista = [...new Set(fontes.filter((f): f is string => Boolean(f)))];
  const proxima = Number(img.dataset.tentativa ?? "0") + 1;
  if (proxima < lista.length) {
    img.dataset.tentativa = String(proxima);
    img.src = lista[proxima];
  }
}

const TAMANHOS = {
  sm: { item: "w-24", quadro: "size-24" },
  md: { item: "w-36", quadro: "size-36" },
} as const;

/**
 * Miniaturas de anexos. Clicar numa imagem abre a visualização ampliada
 * (setas ou teclado navegam entre as imagens); um PDF abre em nova aba.
 */
export function GaleriaAnexos({
  itens,
  onRemover,
  onLegenda,
  tamanho = "sm",
  disabled,
  className,
  rotulo = "Anexos",
}: Props) {
  const imagens = itens.filter((i) => i.tipo === "imagem");
  const [aberta, setAberta] = useState<number | null>(null);
  const atual = aberta !== null ? imagens[aberta] : undefined;
  const t = TAMANHOS[tamanho];

  function passo(delta: number) {
    if (aberta === null || imagens.length === 0) return;
    setAberta((aberta + delta + imagens.length) % imagens.length);
  }

  if (itens.length === 0) return null;

  return (
    <>
      <ul className={cn("flex min-w-0 flex-wrap gap-3", className)} aria-label={rotulo}>
        {itens.map((item) => (
          <li key={item.chave} className={cn("group relative", t.item)}>
            {item.tipo === "imagem" ? (
              <button
                type="button"
                onClick={() => setAberta(imagens.findIndex((i) => i.chave === item.chave))}
                className={cn(
                  "block overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  t.quadro,
                )}
                aria-label={`Ampliar ${item.nome}`}
              >
                {/* blob: e URLs assinadas: a miniatura reduzida vem pronta em `miniatura`. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.miniatura ?? item.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(e) => tentarProxima(e, [item.miniatura ?? item.url, item.url, item.reserva])}
                  className="size-full object-cover"
                />
              </button>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-lg border bg-muted text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  t.quadro,
                )}
                aria-label={`Abrir ${item.nome} em nova aba`}
              >
                <FileTextIcon className="size-7 text-brand-blue dark:text-primary" aria-hidden />
                PDF
              </a>
            )}

            {onLegenda ? (
              <Input
                value={item.legenda ?? ""}
                onChange={(e) => onLegenda(item.chave, e.target.value)}
                placeholder="Legenda (opcional)"
                maxLength={200}
                disabled={disabled}
                aria-label={`Legenda de ${item.nome}`}
                className="mt-1 h-7 px-2 text-xs"
              />
            ) : (
              <>
                <span className="mt-1 block truncate text-xs" title={item.nome}>
                  {item.nome}
                </span>
                {item.detalhe && (
                  <span
                    className="block truncate text-xs text-muted-foreground"
                    title={item.detalhe}
                  >
                    {item.detalhe}
                  </span>
                )}
              </>
            )}

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
              <DialogTitle className="min-w-0 truncate pr-8" title={atual.legenda || atual.nome}>{atual.legenda || atual.nome}</DialogTitle>
              <DialogDescription className={atual.detalhe ? undefined : "sr-only"}>
                {atual.detalhe ??
                  `Imagem ${(aberta ?? 0) + 1} de ${imagens.length}. Use as setas para navegar.`}
              </DialogDescription>
              <div className="flex items-center justify-center rounded-lg bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={atual.chave}
                  src={atual.url}
                  alt={atual.legenda || atual.nome}
                  onError={(e) => tentarProxima(e, [atual.url, atual.reserva])}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={atual.reserva ?? atual.url} target="_blank" rel="noopener noreferrer">
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
