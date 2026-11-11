"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  PERIFERICOS_POR_TIPO,
  PERIFERICO_LABEL,
  ordenarPerifericos,
  temConferencia,
  type Periferico,
} from "@/lib/perifericos";
import type { TipoDispositivo } from "@/lib/types";

type Props = {
  /** Prefixo dos ids (dois diálogos podem estar na mesma página). */
  id: string;
  tipo: TipoDispositivo;
  /** "Periféricos entregues" ou "Periféricos devolvidos". */
  legenda: string;
  selecionados: readonly Periferico[];
  onSelecionadosChange: (lista: Periferico[]) => void;
  formatado: boolean;
  onFormatadoChange: (valor: boolean) => void;
  /** Rótulo do checkbox de formatação. */
  rotuloFormatado: string;
  /** Na devolução: itens que saíram na entrega (marcados com "entregue"). */
  entregues?: readonly Periferico[];
  disabled?: boolean;
};

/**
 * Checkboxes de periféricos do tipo do dispositivo + "Formatado".
 * Monitor não tem conferência: não renderiza nada.
 */
export function ConferenciaPerifericos({
  id,
  tipo,
  legenda,
  selecionados,
  onSelecionadosChange,
  formatado,
  onFormatadoChange,
  rotuloFormatado,
  entregues,
  disabled,
}: Props) {
  if (!temConferencia(tipo)) return null;

  const opcoes = PERIFERICOS_POR_TIPO[tipo];
  const marcados = new Set(selecionados);

  function alternar(p: Periferico, marcado: boolean) {
    const proximo = new Set(marcados);
    if (marcado) proximo.add(p);
    else proximo.delete(p);
    onSelecionadosChange(ordenarPerifericos([...proximo]));
  }

  return (
    <div className="grid gap-3">
      <fieldset className="grid gap-2" disabled={disabled}>
        <legend className="mb-2 text-sm font-medium">{legenda}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {opcoes.map((p) => {
            const idItem = `${id}-${p}`;
            return (
              <div key={p} className="flex items-center gap-2">
                <Checkbox
                  id={idItem}
                  checked={marcados.has(p)}
                  onCheckedChange={(v) => alternar(p, v === true)}
                  disabled={disabled}
                />
                <Label htmlFor={idItem} className="font-normal">
                  {PERIFERICO_LABEL[p]}
                  {entregues?.includes(p) && (
                    <span className="text-xs text-muted-foreground">(entregue)</span>
                  )}
                </Label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-formatado`}
          checked={formatado}
          onCheckedChange={(v) => onFormatadoChange(v === true)}
          disabled={disabled}
        />
        <Label htmlFor={`${id}-formatado`} className="font-normal">
          {rotuloFormatado}
        </Label>
      </div>
    </div>
  );
}
