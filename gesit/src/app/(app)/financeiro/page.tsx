import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { SituacaoVencimentoBadge } from "@/components/financeiro/badges";
import {
  GraficoEvolucaoMensal,
  GraficoGastosPorFilial,
  GraficoGastosPorTipo,
  type GastoFilial,
  type MesGasto,
} from "@/components/financeiro/graficos";
import { NomeFinanceiro } from "@/components/financeiro/nome-financeiro";
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
import { primeiro } from "@/lib/busca";
import {
  comparacaoMesAnterior,
  formatarCompetenciaCurta,
  formatarMes,
  gastosPorFilial,
  gastosPorMes,
  gastosPorTipo,
  hrefLancamento,
  lerMes,
  mesAtualEmPalmas,
  mesCurto,
  mesesEntre,
  resumirLancamentos,
  somarMeses,
} from "@/lib/financeiro";
import { buscarGastosPeriodo, buscarVencimentos } from "@/lib/financeiro-servidor";
import { formatarDataISO, formatarMoeda } from "@/lib/format";
import { listarLojasOpcoes } from "@/lib/lojas";

export const metadata: Metadata = { title: "Painel Financeiro" };

type SearchParams = PageProps<"/financeiro">["searchParams"];

/** Itens por lista de vencimentos. */
const LIMITE_LISTA = 15;

export default function PainelFinanceiroPage({ searchParams }: PageProps<"/financeiro">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Painel Financeiro</h1>
          <p className="text-muted-foreground">Despesas Mensais TI</p>
        </div>
        <Suspense fallback={<div className="h-9 w-96" />}>
          <Seletor />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            <ResumoMesCarregando cartoes={5} />
            <div className="h-96 animate-pulse rounded-xl bg-muted" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-80 animate-pulse rounded-xl bg-muted" />
              <div className="h-80 animate-pulse rounded-xl bg-muted" />
            </div>
          </div>
        }
      >
        <ResumoEGraficos searchParams={searchParams} />
      </Suspense>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Suspense fallback={<TabelaCarregando colunas={5} />}>
          <ListaVencimentos
            titulo="Vence Hoje e Próximos 5 Dias"
            descricao="Em aberto, de qualquer mês. Os que vencem hoje vêm primeiro."
            situacoes={["hoje", "proximo"]}
            vazio="Nada vence hoje nem nos próximos 5 dias."
          />
        </Suspense>
        <Suspense fallback={<TabelaCarregando colunas={5} />}>
          <ListaVencimentos
            titulo="Vencidos em Aberto"
            descricao="De qualquer mês, do vencimento mais antigo para o mais novo."
            situacoes={["vencido"]}
            vazio="Nenhum lançamento vencido em aberto."
          />
        </Suspense>
      </div>
    </div>
  );
}

async function Seletor() {
  await connection(); // horário de Palmas: só na requisição
  return <SeletorMes mesAtual={mesAtualEmPalmas()} />;
}

/** Cards, evolução dos últimos 12 meses e gastos do mês por tipo e por filial. */
async function ResumoEGraficos({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const mes = lerMes(primeiro((await searchParams).mes));
  const inicio = somarMeses(mes, -11);

  let linhas: Awaited<ReturnType<typeof buscarGastosPeriodo>>;
  try {
    linhas = await buscarGastosPeriodo(inicio, mes);
  } catch (e) {
    console.error("Erro ao carregar o painel financeiro:", e);
    return <p className="text-destructive">Não foi possível carregar os lançamentos.</p>;
  }
  const lojas = await listarLojasOpcoes();

  const doMes = linhas.filter((l) => l.competencia?.slice(0, 7) === mes);
  const resumo = resumirLancamentos(doMes);
  const meses = gastosPorMes(linhas, mesesEntre(inicio, mes));
  const anterior = meses.at(-2)?.total ?? 0;

  const evolucao: MesGasto[] = meses.map((m) => ({
    mes: m.mes,
    rotulo: mesCurto(m.mes),
    nome: formatarMes(m.mes),
    total: m.total,
    ...m.porTipo,
  }));

  // Todas as filiais ativas (zeradas se não houver gasto), as inativas só
  // com gasto, e "Geral" para os lançamentos sem filial.
  const porFilial = gastosPorFilial(doMes);
  const filiais: GastoFilial[] = lojas
    .filter((l) => l.ativo || (porFilial.get(l.id) ?? 0) > 0)
    .map((l) => ({ lojaId: l.id, loja: l.nome, valor: porFilial.get(l.id) ?? 0 }));
  filiais.push({ lojaId: null, loja: "Geral", valor: porFilial.get(null) ?? 0 });
  filiais.sort((a, b) => b.valor - a.valor || a.loja.localeCompare(b.loja, "pt-BR"));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{formatarMes(mes)}</h2>
        <ResumoMes
          resumo={resumo}
          comAprovacao
          comparacao={comparacaoMesAnterior(resumo.total.valor, anterior, mes)}
        />
        <p className="text-xs text-muted-foreground">
          Cancelados ficam fora dos valores. Aguardando aprovação: aprovação Não OK ou, sem
          aprovação informada, na situação Solicitado Compras.
        </p>
      </div>

      <GraficoEvolucaoMensal meses={evolucao} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <GraficoGastosPorTipo valores={gastosPorTipo(doMes)} mes={mes} />
        <GraficoGastosPorFilial filiais={filiais} mes={mes} />
      </div>
    </div>
  );
}


async function ListaVencimentos({
  titulo,
  descricao,
  situacoes,
  vazio,
}: {
  titulo: string;
  descricao: string;
  situacoes: string[];
  vazio: string;
}) {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const { data, error, count } = await buscarVencimentos(situacoes, LIMITE_LISTA);

  if (error) {
    console.error(`Erro ao carregar "${titulo}":`, error);
    return <p className="text-destructive">Não foi possível carregar os vencimentos.</p>;
  }

  const total = data.reduce((s, l) => s + (l.valor ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>
          {descricao}
          {data.length > 0 && ` ${formatarMoeda(total)} nos itens listados.`}
          {count !== null && count > data.length && ` Mostrando ${data.length} de ${count}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor / Descrição</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação do Vencimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((l, i) => (
                <TableRow key={l.id ?? i}>
                  <TableCell>
                    <NomeFinanceiro
                      fornecedor={l.fornecedor}
                      descricao={l.descricao}
                      identificador={l.servico_identificador}
                    >
                      {l.id && l.competencia && (
                        // <a> e não <Link>: a navegação completa leva ao #id da
                        // linha (que chega depois, em streaming) e ativa o :target.
                        <a href={hrefLancamento(l.id, l.competencia)} className="hover:underline">
                          {l.fornecedor ?? "—"}
                        </a>
                      )}
                    </NomeFinanceiro>
                  </TableCell>
                  <TableCell>{l.loja_nome ?? "Geral"}</TableCell>
                  <TableCell className="tabular-nums">
                    {l.vencimento ? formatarDataISO(l.vencimento) : "—"}
                    {l.competencia && (
                      <div className="text-xs text-muted-foreground">
                        Competência {formatarCompetenciaCurta(l.competencia)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.valor === null ? "—" : formatarMoeda(l.valor)}
                  </TableCell>
                  <TableCell>
                    <SituacaoVencimentoBadge
                      situacao={l.situacao_vencimento}
                      dias={l.dias_para_vencer}
                    />
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
