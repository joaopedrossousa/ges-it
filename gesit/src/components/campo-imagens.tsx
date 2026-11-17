"use client";

import { CampoAnexos, type ItemAnexo } from "@/components/campo-anexos";
import { Label } from "@/components/ui/label";
import { IMAGEM_ACCEPT, IMAGENS_MAXIMO, validarImagem } from "@/lib/imagens-cliente";

type Props = {
  id: string;
  /** Ex.: "Imagens (opcional)", "Imagens do estado do item (opcional)". */
  rotulo: string;
  itens: ItemAnexo[];
  onChange: (itens: ItemAnexo[]) => void;
  disabled?: boolean;
};

/**
 * Imagens do item (migration 020): CampoAnexos só com imagens, legenda em
 * cada uma e colar print. A compressão acontece no envio (gravarImagens).
 */
export function CampoImagens({ id, rotulo, itens, onChange, disabled }: Props) {
  const ajuda = `${id}-ajuda`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <CampoAnexos
        id={id}
        itens={itens}
        onChange={onChange}
        accept={IMAGEM_ACCEPT}
        validar={validarImagem}
        maximo={IMAGENS_MAXIMO}
        comLegenda
        disabled={disabled}
        descritoPor={ajuda}
      />
      <p id={ajuda} className="text-xs text-muted-foreground">
        JPG, PNG ou WebP, até 10 MB cada. As imagens são reduzidas antes do envio.
      </p>
    </div>
  );
}
