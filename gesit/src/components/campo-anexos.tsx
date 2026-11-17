"use client";

import { cn } from "cn";
import { ClipboardPasteIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { GaleriaAnexos } from "@/components/galeria-anexos";
import { Button } from "@/components/ui/button";

/** Arquivo escolhido, com a URL local (blob:) da miniatura. */
export type ItemAnexo = {
  chave: string;
  arquivo: File;
  url: string;
  /** Com `comLegenda` (imagens do item). */
  legenda?: string;
};

type Props = {
  /** id do botão de escolher (para o <Label htmlFor>). */
  id: string;
  itens: ItemAnexo[];
  onChange: (itens: ItemAnexo[]) => void;
  /** Atributo accept do <input type="file">. */
  accept: string;
  /** Mensagem de erro do arquivo (com o nome), ou null se for aceito. */
  validar: (arquivo: File) => string | null;
  /** Quantidade máxima de arquivos. */
  maximo: number;
  disabled?: boolean;
  invalid?: boolean;
  /** id da ajuda/erro do campo (aria-describedby). */
  descritoPor?: string;
  /** Campo de legenda em cada item (miniaturas maiores). */
  comLegenda?: boolean;
  /**
   * Recebe prints colados (Ctrl+V) na página. Desligue quando houver outro
   * CampoAnexos aberto na tela, para o print não ir para os dois.
   */
  colar?: boolean;
};

const ehImagem = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name);

/** "print-2026-11-17-153012.png" para imagens coladas (vêm como "image.png"). */
function nomeDoPrint(arquivo: File, indice: number) {
  const agora = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const carimbo = `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}`;
  const ext = arquivo.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  return `print-${carimbo}${indice > 0 ? `-${indice + 1}` : ""}.${ext}`;
}

const mesmoArquivo = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Vários anexos com miniaturas: escolher na janela do sistema, arrastar para
 * a área ou colar um print (Ctrl+V em qualquer lugar da página enquanto o
 * campo estiver aberto; texto colado nos outros campos não é afetado).
 * As URLs locais das miniaturas são liberadas ao remover e ao desmontar.
 */
export function CampoAnexos({
  id,
  itens,
  onChange,
  accept,
  validar,
  maximo,
  disabled,
  invalid,
  descritoPor,
  comLegenda,
  colar = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [avisos, setAvisos] = useState<string[]>([]);
  const avisosId = `${id}-avisos`;

  // Libera as URLs que ainda existirem quando o campo sai da tela.
  const itensRef = useRef(itens);
  useEffect(() => {
    itensRef.current = itens;
  }, [itens]);
  useEffect(() => () => itensRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  function adicionar(arquivos: File[], colados = false) {
    if (disabled || arquivos.length === 0) return;
    const novos: ItemAnexo[] = [];
    const problemas: string[] = [];

    arquivos.forEach((original, indice) => {
      const arquivo = colados
        ? new File([original], nomeDoPrint(original, indice), {
            type: original.type,
            lastModified: Date.now(),
          })
        : original;
      if ([...itens, ...novos].some((i) => mesmoArquivo(i.arquivo, arquivo))) return;
      const erro = validar(arquivo);
      if (erro) {
        problemas.push(erro);
        return;
      }
      if (itens.length + novos.length >= maximo) {
        problemas.push(`${arquivo.name}: o limite é de ${maximo} arquivos.`);
        return;
      }
      novos.push({ chave: crypto.randomUUID(), arquivo, url: URL.createObjectURL(arquivo) });
    });

    setAvisos(problemas);
    if (novos.length) onChange([...itens, ...novos]);
  }

  function remover(chave: string) {
    const item = itens.find((i) => i.chave === chave);
    if (item) URL.revokeObjectURL(item.url);
    setAvisos([]);
    onChange(itens.filter((i) => i.chave !== chave));
  }

  // Colar print: só age se a área de transferência tiver arquivos.
  useEffect(() => {
    if (disabled || !colar) return;
    function aoColar(e: ClipboardEvent) {
      const arquivos = Array.from(e.clipboardData?.files ?? []);
      if (arquivos.length === 0) return;
      e.preventDefault();
      adicionar(arquivos, true);
    }
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  });

  return (
    <div className="grid gap-3">
      <div
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          adicionar(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-5 text-center text-sm dark:bg-input/30",
          arrastando && "border-brand-green bg-brand-green/10",
          invalid && "border-destructive ring-3 ring-destructive/20",
          disabled && "opacity-50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          tabIndex={-1}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const escolhidos = Array.from(e.target.files ?? []);
            e.target.value = ""; // escolher o mesmo arquivo de novo dispara onChange
            adicionar(escolhidos);
          }}
        />
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={[descritoPor, avisos.length ? avisosId : null].filter(Boolean).join(" ") || undefined}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
          Escolher arquivos
        </Button>
        <p className="flex flex-wrap items-center justify-center gap-1 text-muted-foreground">
          {colar ? (
            <>
              ou arraste para cá, ou cole um print com
              <kbd className="rounded border bg-muted px-1.5 font-mono text-xs">Ctrl+V</kbd>
              <ClipboardPasteIcon className="size-3.5" aria-hidden />
            </>
          ) : (
            "ou arraste para cá"
          )}
        </p>
      </div>

      {avisos.length > 0 && (
        <ul id={avisosId} role="alert" className="grid gap-0.5 text-sm text-destructive">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <GaleriaAnexos
        itens={itens.map((i) => ({
          chave: i.chave,
          nome: i.arquivo.name,
          tipo: ehImagem(i.arquivo) ? "imagem" : "pdf",
          url: i.url,
          legenda: i.legenda,
        }))}
        onRemover={remover}
        onLegenda={
          comLegenda
            ? (chave, legenda) =>
                onChange(itens.map((i) => (i.chave === chave ? { ...i, legenda } : i)))
            : undefined
        }
        tamanho={comLegenda ? "md" : "sm"}
        disabled={disabled}
      />
      {itens.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {itens.length} de {maximo} {itens.length === 1 ? "arquivo" : "arquivos"}.
        </p>
      )}
    </div>
  );
}
