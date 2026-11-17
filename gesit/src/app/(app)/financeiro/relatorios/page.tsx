import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { mesAtualEmPalmas } from "@/lib/financeiro";
import { listarLojasOpcoes } from "@/lib/lojas";

import { PainelRelatoriosFinanceiros } from "./painel";

export const metadata: Metadata = { title: "Relatórios Financeiros" };

export default function RelatoriosFinanceirosPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios Financeiros</h1>
        <p className="text-muted-foreground">
          Exporte em PDF ou Excel. Valores em reais; cancelados ficam fora dos totais.
        </p>
      </div>

      <Suspense fallback={<PainelCarregando />}>
        <Painel />
      </Suspense>
    </div>
  );
}

async function Painel() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const lojas = await listarLojasOpcoes();
  // Mês atual em Palmas; calculado aqui para não depender do fuso do navegador.
  return <PainelRelatoriosFinanceiros lojas={lojas} mesAtual={mesAtualEmPalmas()} />;
}

function PainelCarregando() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" role="status" aria-label="Carregando...">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
