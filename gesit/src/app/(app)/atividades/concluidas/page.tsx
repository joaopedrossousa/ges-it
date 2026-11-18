import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AmostraCor, Etiqueta, SeloPrioridade } from "@/components/atividades/etiquetas";
import { ExportarMenu } from "@/components/exportar";
import { TabelaCarregando } from "@/components/tabela-carregando";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nomeUsuario, tituloUsuario } from "@/lib/atividades";
import {
  listarAtividadesConcluidas,
  listarCategoriasKanban,
  listarColunasAtivas,
  listarUsuariosSistema,
} from "@/lib/atividades-servidor";
import { formatarMes, mesAtualEmPalmas } from "@/lib/financeiro";
import {
  TODOS_OS_MESES,
  lerFiltrosConcluidas,
  type FiltrosConcluidas as Filtros,
} from "@/lib/filtros-concluidas";
import { formatarDataHora } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { FiltrosConcluidas } from "./filtros";
import { ReabrirAtividade, RestaurarColuna } from "./reabrir";

export const metadata: Metadata = { title: "Atividades Concluídas" };

type SearchParams = PageProps<"/atividades/concluidas">["searchParams"];

const COLUNAS = 7;

/**
 * Atividades concluídas (arquivada no banco, migration 028) e, numa seção
 * separada, as colunas do quadro arquivadas (essas não são "concluídas").
 */
export default function ConcluidasPage({ searchParams }: PageProps<"/atividades/concluidas">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Atividades Concluídas</h1>
          <p className="text-muted-foreground">
            Saíram do quadro como concluídas. Reabra para voltarem ao fim de uma coluna.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/atividades">
            <ArrowLeftIcon />
            Voltar ao quadro
          </Link>
        </Button>
      </div>

      <section className="space-y-3" aria-labelledby="titulo-atividades-concluidas">
        <h2 id="titulo-atividades-concluidas" className="sr-only">
          Atividades
        </h2>
        <Suspense fallback={<div className="h-10" />}>
          <BarraFiltros />
        </Suspense>
        <Suspense fallback={<TabelaCarregando colunas={COLUNAS} />}>
          <TabelaAtividades searchParams={searchParams} />
        </Suspense>
      </section>

      <section className="space-y-3 pt-2" aria-labelledby="titulo-colunas-arquivadas">
        <div className="space-y-1">
          <h2 id="titulo-colunas-arquivadas" className="text-lg font-semibold">
            Colunas Arquivadas
          </h2>
          <p className="text-sm text-muted-foreground">
            Colunas que saíram do quadro, mas continuam guardadas. Restaure para voltarem ao fim do
            quadro.
          </p>
        </div>
        <Suspense fallback={<TabelaCarregando colunas={3} linhas={2} />}>
          <TabelaColunas />
        </Suspense>
      </section>
    </div>
  );
}

async function BarraFiltros() {
  await connection(); // mês de Palmas e sessão: só na requisição
  let usuarios: Awaited<ReturnType<typeof listarUsuariosSistema>> = [];
  try {
    usuarios = await listarUsuariosSistema();
  } catch (e) {
    console.error("Erro ao listar usuários do sistema:", e);
  }
  return <FiltrosConcluidas mesAtual={mesAtualEmPalmas()} usuarios={usuarios} />;
}

/** "3 atividades concluídas em novembro de 2026". */
function contador(total: number, f: Filtros) {
  const qtd = total === 1 ? "1 atividade concluída" : `${total.toLocaleString("pt-BR")} atividades concluídas`;
  const periodo = f.mes ? `em ${formatarMes(f.mes).toLocaleLowerCase("pt-BR")}` : "em todos os meses";
  return `${qtd} ${periodo}`;
}

async function carregarAtividades(f: Filtros) {
  const supabase = await createClient();
  const [atividades, { data: todasColunas, error }, ativas, categorias, usuarios] = await Promise.all([
    listarAtividadesConcluidas(f),
    supabase.from("kanban_colunas").select("id, nome, cor, arquivada"),
    listarColunasAtivas(),
    listarCategoriasKanban(),
    listarUsuariosSistema(),
  ]);
  if (error) throw new Error(error.message);
  return { atividades, todasColunas, ativas, categorias, usuarios };
}

async function TabelaAtividades({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // sessão (o Supabase lê Date.now()) e mês de Palmas: só na requisição
  const filtros = lerFiltrosConcluidas(await searchParams);
  const dados = await carregarAtividades(filtros).catch((e: unknown) => {
    console.error("Erro ao listar atividades concluídas:", e);
    return null;
  });
  if (!dados) {
    return <p className="text-destructive">Não foi possível carregar as atividades concluídas.</p>;
  }

  const { atividades, todasColunas, ativas, categorias, usuarios } = dados;
  const colunas = new Map(todasColunas.map((c) => [c.id, c]));
  const categoriasPorId = new Map(categorias.map((c) => [c.id, c]));
  const usuariosPorId = new Map(usuarios.map((u) => [u.id, u]));
  const comFiltroExtra = Boolean(filtros.q || filtros.responsavel);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {contador(atividades.length, filtros)}
          {comFiltroExtra && " (com os filtros aplicados)"}.
        </p>
        {/* Mesmos filtros da tela; o mês vai sempre explícito (o atual também). */}
        <ExportarMenu
          relatorio="atividades-concluidas"
          params={{
            mes: filtros.mes ?? TODOS_OS_MESES,
            responsavel: filtros.responsavel || undefined,
            q: filtros.q || undefined,
          }}
          desabilitado={atividades.length === 0}
          dica="Nenhuma atividade para exportar com esses filtros"
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atividade</TableHead>
              <TableHead>Coluna de Origem</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Categorias</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Concluída</TableHead>
              <TableHead className="w-0 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {atividades.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUNAS} className="py-8 text-center text-muted-foreground">
                  {comFiltroExtra
                    ? "Nenhuma atividade concluída encontrada com esses filtros."
                    : filtros.mes
                      ? `Nenhuma atividade concluída em ${formatarMes(filtros.mes).toLocaleLowerCase("pt-BR")}.`
                      : "Nenhuma atividade concluída."}
                </TableCell>
              </TableRow>
            )}
            {atividades.map((a) => {
              const coluna = colunas.get(a.coluna_id);
              const responsavel = a.responsavel_id ? usuariosPorId.get(a.responsavel_id) : undefined;
              const autor = a.concluida_por ? usuariosPorId.get(a.concluida_por) : undefined;
              return (
                <TableRow key={a.id}>
                  <TableCell className="max-w-96 font-medium whitespace-normal wrap-anywhere">
                    {a.titulo}
                  </TableCell>
                  <TableCell>
                    {coluna ? (
                      <span className="flex items-center gap-1.5">
                        <AmostraCor cor={coluna.cor} />
                        {coluna.nome}
                        {coluna.arquivada && (
                          <span className="text-xs text-muted-foreground">(arquivada)</span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell title={tituloUsuario(responsavel)}>
                    {a.responsavel_id ? (responsavel ? nomeUsuario(responsavel) : "Usuário removido") : "—"}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    {a.categorias.length === 0 ? (
                      "—"
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {a.categorias.map((id) => {
                          const c = categoriasPorId.get(id);
                          return c ? (
                            <Etiqueta key={id} cor={c.cor}>
                              {c.nome}
                            </Etiqueta>
                          ) : null;
                        })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <SeloPrioridade prioridade={a.prioridade} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="tabular-nums">{a.concluida_em ? formatarDataHora(a.concluida_em) : "—"}</div>
                    <div className="text-xs text-muted-foreground" title={tituloUsuario(autor)}>
                      {a.concluida_por
                        ? `Por ${autor ? nomeUsuario(autor) : "usuário removido"}`
                        : "Autor não registrado"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <ReabrirAtividade atividade={a} colunas={ativas} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

async function TabelaColunas() {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kanban_colunas")
    .select("id, nome, cor, updated_at")
    .eq("arquivada", true)
    .order("nome")
    .order("id");

  if (error) {
    console.error("Erro ao listar colunas arquivadas:", error);
    return <p className="text-destructive">Não foi possível carregar as colunas arquivadas.</p>;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Coluna</TableHead>
            <TableHead>Última Alteração</TableHead>
            <TableHead className="w-0 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                Nenhuma coluna arquivada.
              </TableCell>
            </TableRow>
          )}
          {data.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <AmostraCor cor={c.cor} />
                  {c.nome}
                </span>
              </TableCell>
              <TableCell className="tabular-nums">{formatarDataHora(c.updated_at)}</TableCell>
              <TableCell className="text-right">
                <RestaurarColuna coluna={c} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
