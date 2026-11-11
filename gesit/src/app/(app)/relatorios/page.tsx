import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { listarLojasOpcoes } from "@/lib/lojas";
import { periodoMovimentacoes } from "@/lib/relatorios/dados";

import { PainelRelatorios } from "./painel";

export const metadata: Metadata = { title: "Relatórios" };

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Exporte em PDF ou Excel. O inventário completo sai pelo botão Exportar em{" "}
          <Link href="/dispositivos" className="text-primary underline-offset-4 hover:underline">
            Dispositivos
          </Link>
          , com os filtros da listagem; os históricos, na página de cada dispositivo e usuário.
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
  const periodoPadrao = periodoMovimentacoes(new URLSearchParams(), new Date());
  return <PainelRelatorios lojas={lojas} periodoPadrao={periodoPadrao} />;
}

function PainelCarregando() {
  return (
    <div className="grid gap-6 lg:grid-cols-3" role="status" aria-label="Carregando...">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
