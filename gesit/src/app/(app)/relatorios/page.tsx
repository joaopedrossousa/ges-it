import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  listarCategoriasKanban,
  listarUsuariosSistema,
} from "@/lib/atividades-servidor";
import { mesAtualEmPalmas } from "@/lib/financeiro";
import { listarLojasOpcoes } from "@/lib/lojas";
import { periodoMovimentacoes } from "@/lib/relatorios/dados";
import { createClient } from "@/lib/supabase/server";

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
          , com os filtros da listagem (a lista de colaboradores, também em{" "}
          <Link href="/colaboradores" className="text-primary underline-offset-4 hover:underline">
            Colaboradores
          </Link>
          ); os históricos, na página de cada dispositivo e colaborador; as
          atividades concluídas, também na tela{" "}
          <Link
            href="/atividades/concluidas"
            className="text-primary underline-offset-4 hover:underline"
          >
            Concluídas
          </Link>
          .
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
  const [lojas, atividades] = await Promise.all([
    listarLojasOpcoes(),
    // Sem as opções de atividades, o cartão delas ainda exporta (só sem esses filtros).
    opcoesAtividades().catch((e: unknown) => {
      console.error("Erro ao carregar as opções do relatório de atividades:", e);
      return { usuarios: [], colunas: [], categorias: [] };
    }),
  ]);
  // Mês atual em Palmas; calculado aqui para não depender do fuso do navegador.
  const agora = new Date();
  const periodoPadrao = periodoMovimentacoes(new URLSearchParams(), agora);
  return (
    <PainelRelatorios
      lojas={lojas}
      periodoPadrao={periodoPadrao}
      mesAtual={mesAtualEmPalmas(agora)}
      atividades={atividades}
    />
  );
}

/** Usuários, colunas (ativas na ordem do quadro, depois as arquivadas) e categorias. */
async function opcoesAtividades() {
  const supabase = await createClient();
  const [usuarios, categorias, { data: colunas, error }] = await Promise.all([
    listarUsuariosSistema(),
    listarCategoriasKanban(),
    supabase
      .from("kanban_colunas")
      .select("id, nome, arquivada")
      .order("arquivada")
      .order("posicao")
      .order("nome")
      .order("id"),
  ]);
  if (error) throw new Error(error.message);
  return { usuarios, colunas, categorias };
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
