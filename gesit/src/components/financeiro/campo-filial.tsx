"use client";

import type { Ref } from "react";

import { ComboboxLista } from "@/components/combobox-lista";
import type { LojaOpcao } from "@/lib/lojas";
import { opcoesLojas } from "@/lib/opcoes-lojas";

/** Valor da opção "sem filial" (o ComboboxLista não tem opção vazia). */
const SEM_FILIAL = "nenhuma";

/**
 * Filial opcional dos formulários financeiros. Valor "" = não informada.
 * Lojas inativas só aparecem se forem a já gravada (`atual`).
 */
export function CampoFilial({
  id,
  lojas,
  atual,
  value,
  onChange,
  onBlur,
  ref,
  disabled,
  invalid,
  descritoPor,
}: {
  id: string;
  lojas: LojaOpcao[];
  atual: string | null;
  value: string;
  onChange: (valor: string) => void;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  disabled?: boolean;
  invalid?: boolean;
  descritoPor?: string;
}) {
  const opcoes = [
    { value: SEM_FILIAL, label: "Não informada" },
    ...opcoesLojas(lojas.filter((l) => l.ativo || l.id === atual || l.id === value)),
  ];
  return (
    <ComboboxLista
      id={id}
      ref={ref}
      opcoes={opcoes}
      value={value || SEM_FILIAL}
      onChange={(v) => onChange(v === SEM_FILIAL ? "" : v)}
      onBlur={onBlur}
      placeholderBusca="Buscar loja ou cidade..."
      vazio="Nenhuma loja encontrada."
      disabled={disabled}
      invalid={invalid}
      descritoPor={descritoPor}
    />
  );
}
