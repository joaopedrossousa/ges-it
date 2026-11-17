import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Etiqueta, AmostraCor, SeloPrioridade } from "@/components/atividades/etiquetas";
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
import { nomeUsuario } from "@/lib/atividades";
import {
  SELECT_ATIVIDADE,
  listarCategoriasKanban,
  listarColunasAtivas,
  listarUsuariosSistema,
  paraAtividadeQuadro,
} from "@/lib/atividades-servidor";
import { formatarDataHora, formatarDataISO } from "@/lib/format";
import { buscarTodas } from "@/lib/relatorios/comum";
import { createClient } from "@/lib/supabase/server";

import { RestaurarAtividade, RestaurarColuna } from "./restaurar";

export const metadata: Metadata = { title: "Atividades Arquivadas" };

export default function ArquivadasPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Atividades Arquivadas</h1>
          <p className="text-muted-foreground">
            Saíram do quadro, mas continuam guardadas. Restaure para voltarem ao fim de uma coluna.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/atividades">
            <ArrowLeftIcon />
            Voltar ao quadro
          </Link>
        </Button>
      </div>

      <section className="space-y-3" aria-labelledby="titulo-atividades-arquivadas">
        <h2 id="titulo-atividades-arquivadas" className="text-lg font-semibold">
          Atividades
        </h2>
        <Suspense fallback={<TabelaCarregando colunas={6} />}>
          <TabelaAtividades />
        </Suspense>
      </section>

      <section className="space-y-3" aria-labelledby="titulo-colunas-arquivadas">
        <h2 id="titulo-colunas-arquivadas" className="text-lg font-semibold">
          Colunas
        </h2>
        <Suspense fallback={<TabelaCarregando colunas={3} linhas={2} />}>
          <TabelaColunas />
        </Suspense>
      </section>
    </div>
  );
}

async function TabelaAtividades() {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  const supabase = await createClient();

  let dados;
  try {
    dados = await Promise.all([
      buscarTodas((de, ate) =>
        supabase
          .from("kanban_atividades")
          .select(SELECT_ATIVIDADE)
          .eq("arquivada", true)
          .order("updated_at", { ascending: false })
          .order("id")
          .range(de, ate),
      ),
      supabase.from("kanban_colunas").select("id, nome, cor, arquivada"),
      listarColunasAtivas(),
      listarCategoriasKanban(),
      listarUsuariosSistema(),
    ]);
  } catch (e) {
    console.error("Erro ao listar atividades arquivadas:", e);
    return <p className="text-destructive">Não foi possível carregar as atividades arquivadas.</p>;
  }
  const [linhas, { data: todasColunas, error }, ativas, categorias, usuarios] = dados;
  if (error) {
    console.error("Erro ao listar colunas:", error);
    return <p className="text-destructive">Não foi possível carregar as atividades arquivadas.</p>;
  }

  const atividades = linhas.map(paraAtividadeQuadro);
  const colunas = new Map(todasColunas.map((c) => [c.id, c]));
  const categoriasPorId = new Map(categorias.map((c) => [c.id, c]));
  const usuariosPorId = new Map(usuarios.map((u) => [u.id, u]));

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atividade</TableHead>
            <TableHead>Coluna</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Última Alteração</TableHead>
            <TableHead className="w-0 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {atividades.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Nenhuma atividade arquivada.
              </TableCell>
            </TableRow>
          )}
          {atividades.map((a) => {
            const coluna = colunas.get(a.coluna_id);
            return (
              <TableRow key={a.id}>
                <TableCell className="max-w-96 whitespace-normal">
                  <div className="font-medium">{a.titulo}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <SeloPrioridade prioridade={a.prioridade} />
                    {a.categorias.map((id) => {
                      const c = categoriasPorId.get(id);
                      return c ? (
                        <Etiqueta key={id} cor={c.cor}>
                          {c.nome}
                        </Etiqueta>
                      ) : null;
                    })}
                  </div>
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
                <TableCell>
                  {a.responsavel_id ? nomeUsuario(usuariosPorId.get(a.responsavel_id)) : "—"}
                </TableCell>
                <TableCell className="tabular-nums">{a.prazo ? formatarDataISO(a.prazo) : "—"}</TableCell>
                <TableCell className="tabular-nums">{formatarDataHora(a.updated_at)}</TableCell>
                <TableCell className="text-right">
                  <RestaurarAtividade atividade={a} colunas={ativas} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
