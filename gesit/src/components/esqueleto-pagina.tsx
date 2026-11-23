import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * Formato do conteúdo enquanto a tela carrega:
 * - tabela: barra de filtros e linhas (listagens);
 * - painel: cartões de indicadores e gráficos (Dashboard, Painel Financeiro);
 * - quadro: colunas do Kanban;
 * - detalhe: cartões de uma tela de detalhe;
 * - cartoes: grade de cartões (Relatórios);
 * - inicio: blocos da tela Início.
 */
export type VarianteEsqueleto = "tabela" | "painel" | "quadro" | "detalhe" | "cartoes" | "inicio";

/** Bloco cinza pulsando. */
function Barra({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

function Tabela() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Barra className="h-9 w-full max-w-sm" />
        <Barra className="h-9 w-40" />
        <Barra className="h-9 w-40" />
      </div>
      <div className="rounded-lg border p-4">
        <div className="grid gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 sm:grid-cols-6">
              {Array.from({ length: 6 }, (_, j) => (
                <Barra key={j} className={cn("h-4 rounded", j >= 4 && "hidden sm:block")} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Painel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Barra key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Barra className="h-80 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Barra className="h-64 rounded-xl" />
        <Barra className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

function Quadro() {
  return (
    <div className="space-y-4">
      <Barra className="h-8 w-full max-w-md" />
      <div className="flex gap-4 overflow-hidden">
        {[3, 2, 4, 1].map((n, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2 rounded-xl bg-muted/70 p-2">
            <Barra className="h-6 w-32 rounded" />
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className="h-20 animate-pulse rounded-lg bg-background" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Detalhe() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Barra className="h-48 rounded-xl" />
        <Barra className="h-48 rounded-xl" />
      </div>
      <Barra className="h-64 rounded-xl" />
    </div>
  );
}

function Cartoes() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <Barra key={i} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}

function Inicio() {
  return (
    <div className="space-y-6">
      <Barra className="h-40 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Barra className="h-56 rounded-xl" />
        <Barra className="h-56 rounded-xl" />
      </div>
      <Barra className="h-64 rounded-xl" />
    </div>
  );
}

const CONTEUDO: Record<VarianteEsqueleto, () => ReactNode> = {
  tabela: Tabela,
  painel: Painel,
  quadro: Quadro,
  detalhe: Detalhe,
  cartoes: Cartoes,
  inicio: Inicio,
};

/**
 * Esqueleto de tela inteira para os loading.tsx: o título real da tela (sem
 * esperar o servidor), um subtítulo e o formato do conteúdo. Aparece na troca
 * de aba enquanto o shell da tela ainda não chegou; depois, cada bloco da tela
 * tem o próprio <Suspense>.
 */
export function EsqueletoPagina({
  titulo,
  variante = "tabela",
}: {
  /** Título da tela, igual ao h1 da página. Sem ele, uma barra no lugar. */
  titulo?: string;
  variante?: VarianteEsqueleto;
}) {
  const Conteudo = CONTEUDO[variante];
  return (
    <div role="status" aria-label={titulo ? `Carregando ${titulo}...` : "Carregando..."} className="space-y-6">
      <div className="space-y-2">
        {titulo ? (
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        ) : (
          <Barra className="h-8 w-56" />
        )}
        <Barra className="h-4 w-full max-w-md rounded" />
      </div>
      <Conteudo />
    </div>
  );
}
