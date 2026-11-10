"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { LojaOpcao } from "./dados";

const TODAS = "todas";

export function Filtros({ lojas }: { lojas: LojaOpcao[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const qAtual = searchParams.get("q") ?? "";
  const lojaAtual = searchParams.get("loja") ?? TODAS;
  const [busca, setBusca] = useState(qAtual);

  function atualizar(chave: "q" | "loja", valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor && valor !== TODAS) params.set(chave, valor);
    else params.delete(chave);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Busca com atraso para não consultar a cada tecla.
  useEffect(() => {
    if (busca.trim() === qAtual) return;
    const t = setTimeout(() => atualizar("q", busca.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative sm:max-w-sm sm:flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou e-mail"
          aria-label="Buscar por nome, CPF ou e-mail"
          className="pl-8"
        />
      </div>

      <Select value={lojaAtual} onValueChange={(v) => atualizar("loja", v)}>
        <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por loja">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Todas as lojas</SelectItem>
          {lojas.map((loja) => (
            <SelectItem key={loja.id} value={loja.id}>
              {loja.nome}
              {!loja.ativo && " (inativa)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isPending && (
        <Loader2Icon
          className="size-4 animate-spin text-muted-foreground"
          aria-label="Atualizando..."
        />
      )}
    </div>
  );
}
