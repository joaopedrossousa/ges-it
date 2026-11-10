"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/** Valor de select que significa "sem filtro". */
export const TODOS = "todos";

/** Lê e grava filtros na query string da página atual (sem rolar a tela). */
export function useFiltrosUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function valor(chave: string, padrao = TODOS) {
    return searchParams.get(chave) ?? padrao;
  }

  function atualizar(chave: string, novo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (novo && novo !== TODOS) params.set(chave, novo);
    else params.delete(chave);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return { valor, atualizar, isPending };
}
