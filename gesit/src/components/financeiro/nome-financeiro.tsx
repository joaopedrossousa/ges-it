import type { ReactNode } from "react";

import { detalheFinanceiro } from "@/lib/financeiro";

/**
 * Nome de serviço/lançamento em duas linhas: fornecedor em destaque e,
 * embaixo, "descrição · identificador" quando houver. `children` substitui
 * o fornecedor (ex.: um link com o mesmo texto).
 */
export function NomeFinanceiro({
  fornecedor,
  descricao,
  identificador,
  children,
}: {
  fornecedor: string | null;
  descricao?: string | null;
  identificador?: string | null;
  children?: ReactNode;
}) {
  const detalhe = detalheFinanceiro({ fornecedor, descricao, identificador });
  return (
    <div className="leading-tight">
      <div className="font-medium">{children ?? fornecedor ?? "—"}</div>
      {detalhe && <div className="text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  );
}
