"use client";

import { useSearchParams } from "next/navigation";

import { ExportarMenu } from "@/components/exportar";

/** Exporta o inventário com os mesmos filtros da listagem (lidos da URL). */
export function ExportarDispositivos() {
  const searchParams = useSearchParams();
  const params = Object.fromEntries(
    ["q", "tipo", "status", "loja"].map((chave) => [chave, searchParams.get(chave) ?? undefined]),
  );
  return <ExportarMenu relatorio="inventario" params={params} />;
}
