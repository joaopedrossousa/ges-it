import { TagsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import {
  listarAtividadesAtivas,
  listarCategoriasKanban,
  listarColunasAtivas,
  listarUsuariosSistema,
  usuarioLogadoId,
} from "@/lib/atividades-servidor";
import { hojeEmPalmas } from "@/lib/format";

import { NovaColunaBotao } from "./coluna-form-dialog";
import { Quadro } from "./quadro";

export const metadata: Metadata = { title: "Atividades" };

export default function AtividadesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Atividades</h1>
          <p className="text-muted-foreground">
            Quadro da equipe de T.I. Arraste os cartões entre as colunas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/atividades/categorias">
              <TagsIcon />
              Categorias
            </Link>
          </Button>
          <NovaColunaBotao />
        </div>
      </div>

      <Suspense fallback={<QuadroCarregando />}>
        <QuadroComDados />
      </Suspense>
    </div>
  );
}

async function QuadroComDados() {
  await connection(); // sessão (o Supabase lê Date.now()) e "hoje" em Palmas: só na requisição
  let dados;
  try {
    dados = await Promise.all([
      listarColunasAtivas(),
      listarAtividadesAtivas(),
      listarCategoriasKanban(),
      listarUsuariosSistema(),
      // Usuário logado: só o autor edita/remove o próprio comentário.
      usuarioLogadoId(),
    ]);
  } catch (e) {
    console.error("Erro ao carregar o quadro de atividades:", e);
    return <p className="text-destructive">Não foi possível carregar o quadro.</p>;
  }
  const [colunas, atividades, categorias, usuarios, usuarioId] = dados;
  return (
    <Quadro
      colunas={colunas}
      atividades={atividades}
      categorias={categorias}
      usuarios={usuarios}
      hoje={hojeEmPalmas()}
      usuarioId={usuarioId}
    />
  );
}

function QuadroCarregando() {
  return (
    <div role="status" aria-label="Carregando o quadro..." className="space-y-4">
      <div className="h-8 w-full max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-4 overflow-hidden">
        {[3, 2, 4, 1].map((n, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2 rounded-xl bg-muted/70 p-2">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className="h-20 animate-pulse rounded-lg bg-background" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
