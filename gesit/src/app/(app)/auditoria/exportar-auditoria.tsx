"use client";

import { FileSpreadsheetIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Carregando } from "@/components/carregando";
import { useExportar } from "@/components/exportar";
import { Button } from "@/components/ui/button";

/** Exporta o log em Excel com os mesmos filtros da página (lidos da URL). */
export function ExportarAuditoria() {
  const searchParams = useSearchParams();
  const { gerando, exportar } = useExportar();
  const params = Object.fromEntries(
    ["de", "ate", "usuario", "tipo", "acao", "registro"].map((chave) => [
      chave,
      searchParams.get(chave) ?? undefined,
    ]),
  );

  return (
    <Button
      variant="outline"
      disabled={gerando !== null}
      onClick={() => void exportar("auditoria", "xlsx", params)}
    >
      {gerando ? <Carregando decorativo tamanho="sm" /> : <FileSpreadsheetIcon />}
      {gerando ? "Gerando..." : "Exportar Excel"}
    </Button>
  );
}
