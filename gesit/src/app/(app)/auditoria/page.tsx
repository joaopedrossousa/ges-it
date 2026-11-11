import { FileSpreadsheetIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Paginacao, PaginaInexistente } from "@/components/paginacao";
import { TabelaAuditoria } from "@/components/tabela-auditoria";
import { TabelaCarregando } from "@/components/tabela-carregando";
import { Button } from "@/components/ui/button";
import { consultaAuditoria, montarLinhasAuditoria } from "@/lib/auditoria-servidor";
import { faixaDaPagina, paginaDoParametro, primeiro } from "@/lib/busca";
import { lerFiltrosAuditoria, temFiltroAuditoria } from "@/lib/filtros-auditoria";
import { createClient } from "@/lib/supabase/server";

import { ExportarAuditoria } from "./exportar-auditoria";
import { Filtros } from "./filtros";

export const metadata: Metadata = { title: "Auditoria" };

type SearchParams = PageProps<"/auditoria">["searchParams"];

export default function AuditoriaPage({ searchParams }: PageProps<"/auditoria">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
          <p className="text-muted-foreground">
            Quem inseriu ou alterou usuários, dispositivos, lojas, vínculos e serviços.
          </p>
        </div>
        {/* useSearchParams: precisa de Suspense no shell estático. */}
        <Suspense
          fallback={
            <Button variant="outline" disabled>
              <FileSpreadsheetIcon />
              Exportar Excel
            </Button>
          }
        >
          <ExportarAuditoria />
        </Suspense>
      </div>

      <Suspense fallback={<div className="h-14" />}>
        <BarraDeFiltros />
      </Suspense>

      <Suspense fallback={<TabelaCarregando colunas={6} />}>
        <TabelaLog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BarraDeFiltros() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("usuarios_auditoria");
  if (error) console.error("Erro ao listar usuários da auditoria:", error);
  return <Filtros usuarios={data ?? []} />;
}

async function TabelaLog({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const params = await searchParams;
  const filtros = lerFiltrosAuditoria(params);

  const pagina = paginaDoParametro(primeiro(params.page));
  const { de, ate } = faixaDaPagina(pagina);

  const supabase = await createClient();
  const { data, count, error } = await consultaAuditoria(supabase, filtros, true).range(de, ate);

  if (error?.code === "PGRST103") {
    return <PaginaInexistente pathname="/auditoria" params={params} />;
  }

  let linhas;
  try {
    if (error) throw error;
    linhas = await montarLinhasAuditoria(supabase, data);
  } catch (e) {
    console.error("Erro ao carregar a auditoria:", e);
    return <p className="text-destructive">Não foi possível carregar o log de auditoria.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border">
        <TabelaAuditoria
          linhas={linhas}
          mostrarRegistro
          vazio={
            temFiltroAuditoria(filtros)
              ? "Nenhuma alteração encontrada com esses filtros."
              : "Nenhuma alteração registrada ainda."
          }
        />
      </div>
      <Paginacao
        pathname="/auditoria"
        params={params}
        pagina={pagina}
        total={count ?? linhas.length}
        rotulo={["registro", "registros"]}
      />
    </div>
  );
}
