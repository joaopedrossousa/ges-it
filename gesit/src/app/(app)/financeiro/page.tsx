import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { SituacaoVencimentoBadge } from "@/components/financeiro/badges";
import { ResumoMes, ResumoMesCarregando } from "@/components/financeiro/resumo-mes";
import { SeletorMes } from "@/components/financeiro/seletor-mes";
import { TabelaCarregando } from "@/components/tabela-carregando";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TIPO_DESPESA_LABEL,
  formatarCompetenciaCurta,
  formatarMes,
  lerMes,
  mesAtualEmPalmas,
  resumirLancamentos,
} from "@/lib/financeiro";
import { buscarLancamentosDoMes } from "@/lib/financeiro-servidor";
import { primeiro } from "@/lib/busca";
import { formatarDataISO, formatarMoeda } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_DESPESA } from "@/lib/types";

export const metadata: Metadata = { title: "Painel financeiro" };

type SearchParams = PageProps<"/financeiro">["searchParams"];

/** Quantos vencidos/próximos aparecem na lista de atenção. */
const LIMITE_ATENCAO = 15;

export default function PainelFinanceiroPage({ searchParams }: PageProps<"/financeiro">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Painel financeiro</h1>
          <p className="text-muted-foreground">Despesas de T.I. do mês e o que precisa de atenção.</p>
        </div>
        <Suspense fallback={<div className="h-9 w-72" />}>
          <Seletor />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            <ResumoMesCarregando />
            <TabelaCarregando colunas={5} />
          </div>
        }
      >
        <ResumoDoMes searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<TabelaCarregando colunas={6} />}>
        <Atencao />
      </Suspense>
    </div>
  );
}

async function Seletor() {
  await connection(); // horário de Palmas: só na requisição
  return <SeletorMes mesAtual={mesAtualEmPalmas()} />;
}

function hrefLancamentos(mes: string, extra: Record<string, string> = {}) {
  return `/financeiro/lancamentos?${new URLSearchParams({ mes, ...extra }).toString()}`;
}

async function ResumoDoMes({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const mes = lerMes(primeiro((await searchParams).mes));
  const { data, error } = await buscarLancamentosDoMes({ mes, busca: "" });

  if (error) {
    console.error("Erro ao carregar o painel financeiro:", error);
    return <p className="text-destructive">Não foi possível carregar os lançamentos do mês.</p>;
  }

  const porTipo = TIPOS_DESPESA.map((tipo) => {
    const linhas = data.filter((l) => l.tipo === tipo);
    return { tipo, quantidade: linhas.length, resumo: resumirLancamentos(linhas) };
  }).filter((t) => t.quantidade > 0);
  const geral = resumirLancamentos(data);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{formatarMes(mes)}</h2>
        <ResumoMes resumo={geral} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Por tipo</CardTitle>
          <CardDescription>Cancelados ficam fora dos valores.</CardDescription>
        </CardHeader>
        <CardContent>
          {porTipo.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum lançamento neste mês.{" "}
              <Link
                href={hrefLancamentos(mes)}
                className="text-primary underline-offset-4 hover:underline"
              >
                Ir para Lançamentos
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Lançamentos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Em aberto</TableHead>
                  <TableHead className="text-right">Vencido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porTipo.map(({ tipo, quantidade, resumo }) => (
                  <TableRow key={tipo}>
                    <TableCell className="font-medium">
                      <Link
                        href={hrefLancamentos(mes, { tipo })}
                        className="hover:underline"
                      >
                        {TIPO_DESPESA_LABEL[tipo]}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{quantidade}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarMoeda(resumo.total.valor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarMoeda(resumo.pago.valor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarMoeda(resumo.aberto.valor)}
                    </TableCell>
                    <TableCell
                      className={
                        resumo.vencido.valor > 0
                          ? "text-right font-medium text-destructive tabular-nums"
                          : "text-right tabular-nums"
                      }
                    >
                      {formatarMoeda(resumo.vencido.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Em aberto, de qualquer mês: vencidos e os que vencem em até 5 dias. */
async function Atencao() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("vw_lancamentos")
    .select(
      "id, competencia, descricao, servico_identificador, loja_nome, vencimento, valor, situacao_vencimento",
      { count: "exact" },
    )
    .in("situacao_vencimento", ["vencido", "proximo"])
    .order("vencimento")
    .order("id")
    .limit(LIMITE_ATENCAO);

  if (error) {
    console.error("Erro ao carregar vencimentos:", error);
    return <p className="text-destructive">Não foi possível carregar os vencimentos.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vencidos e vencendo em até 5 dias</CardTitle>
        <CardDescription>
          Lançamentos em aberto de qualquer mês, do vencimento mais antigo para o mais novo.
          {count !== null && count > data.length && ` Mostrando ${data.length} de ${count}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada vencido ou para vencer nos próximos dias.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição / identificador</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação do venc.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((l, i) => (
                <TableRow key={l.id ?? i}>
                  <TableCell>
                    <div className="leading-tight">
                      {l.competencia ? (
                        <Link
                          href={hrefLancamentos(l.competencia.slice(0, 7))}
                          className="font-medium hover:underline"
                        >
                          {l.descricao ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-medium">{l.descricao ?? "—"}</span>
                      )}
                      {l.servico_identificador && (
                        <div className="text-xs text-muted-foreground">
                          {l.servico_identificador}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{l.loja_nome ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {l.competencia ? formatarCompetenciaCurta(l.competencia) : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {l.vencimento ? formatarDataISO(l.vencimento) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.valor === null ? "—" : formatarMoeda(l.valor)}
                  </TableCell>
                  <TableCell>
                    <SituacaoVencimentoBadge situacao={l.situacao_vencimento} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
