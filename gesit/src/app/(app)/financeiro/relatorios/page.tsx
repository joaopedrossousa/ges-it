import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Relatórios financeiros" };

/** Espaço reservado: os relatórios do módulo ainda serão definidos. */
export default function RelatoriosFinanceirosPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios financeiros</h1>
        <p className="text-muted-foreground">Exportação em PDF e Excel da Gestão Financeira.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 text-sm text-card-foreground">
        <p className="font-medium">Em breve.</p>
        <p className="mt-1 text-muted-foreground">
          Por enquanto, os totais do mês ficam no{" "}
          <Link href="/financeiro" className="text-primary underline-offset-4 hover:underline">
            Painel
          </Link>{" "}
          e o detalhe, com filtros, em{" "}
          <Link
            href="/financeiro/lancamentos"
            className="text-primary underline-offset-4 hover:underline"
          >
            Lançamentos
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
