"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

type Props = {
  valorInicial: string;
  placeholder: string;
  /** Chamado com o texto (sem espaços nas pontas) após uma pausa na digitação. */
  onBuscar: (valor: string) => void;
  atraso?: number;
};

export function CampoBusca({
  valorInicial,
  placeholder,
  onBuscar,
  atraso = 350,
}: Props) {
  const [valor, setValor] = useState(valorInicial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="relative sm:max-w-sm sm:flex-1">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={valor}
        onChange={(e) => {
          const novo = e.target.value;
          setValor(novo);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onBuscar(novo.trim()), atraso);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-8"
      />
    </div>
  );
}
