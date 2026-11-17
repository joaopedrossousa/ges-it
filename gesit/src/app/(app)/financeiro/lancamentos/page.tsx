import { PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Fragment, Suspense } from "react";

import { SituacaoPagamentoBadge, SituacaoVencimentoBadge } from "@/components/financeiro/badges";
import { NomeFinanceiro } from "@/components/financeiro/nome-financeiro";
import { ResumoMes, ResumoMesCarregando } from "@/components/financeiro/resumo-mes";
import { LinkAnexoLancamento } from "@/components/link-anexo-lancamento";
import { TabelaCarregando } from "@/components/tabela-carregando";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TIPO_DESPESA_LABEL,
  competenciaDoMes,
  formatarMes,
  mesAtualEmPalmas,
  nomeFinanceiro,
  resumirLancamentos,
  rotuloAprovacao,
  somarValores,
} from "@/lib/financeiro";
import {
  LIMITE_LANCAMENTOS_MES,
  buscarLancamentosDoMes,
  listarServicosFinanceirosOpcoes,
  type LancamentoLinha,
} from "@/lib/financeiro-servidor";
import { lerFiltrosLancamentos } from "@/lib/filtros-financeiro";
import { formatarDataISO, formatarMoeda } from "@/lib/format";
import { listarLojasOpcoes } from "@/lib/lojas";
import { TIPOS_DESPESA } from "@/lib/types";

import { FiltrosLancamentos } from "./filtros";
import { LancamentoFormDialog, type LancamentoEditavel } from "./lancamento-form-dialog";
import { SituacaoMenu } from "./situacao-menu";

export const metadata: Metadata = { title: "Lançamentos" };

type SearchParams = PageProps<"/financeiro/lancamentos">["searchParams"];

const COLUNAS = 12;

export default function LancamentosPage({ searchParams }: PageProps<"/financeiro/lancamentos">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Lançamentos</h1>
          <p className="text-muted-foreground">Despesas do mês, por tipo, com a situação do pagamento.</p>
        </div>
        <Suspense
          fallback={
            <Button disabled>
              <PlusIcon />
              Novo lançamento
            </Button>
          }
        >
          <NovoLancamento searchParams={searchParams} />
        </Suspense>
      </div>

      <Suspense fallback={<div className="h-20" />}>
        <BarraDeFiltros />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-6">
            <ResumoMesCarregando />
            <TabelaCarregando colunas={8} />
          </div>
        }
      >
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** O formulário precisa das lojas, do catálogo e do mês aberto na tela. */
async function NovoLancamento({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const { mes } = lerFiltrosLancamentos(await searchParams);
  const [lojas, servicos] = await Promise.all([
    listarLojasOpcoes(),
    listarServicosFinanceirosOpcoes(),
  ]);
  return (
    <LancamentoFormDialog
      lojas={lojas}
      servicos={servicos}
      competenciaPadrao={competenciaDoMes(mes)}
      trigger={
        <Button>
          <PlusIcon />
          Novo lançamento
        </Button>
      }
    />
  );
}

async function BarraDeFiltros() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const lojas = await listarLojasOpcoes();
  return <FiltrosLancamentos lojas={lojas} mesAtual={mesAtualEmPalmas()} />;
}

/** Linhas da view vêm com colunas anuláveis; só edita se os dados básicos existirem. */
function paraEdicao(l: LancamentoLinha): LancamentoEditavel | null {
  if (
    !l.id ||
    !l.competencia ||
    !l.tipo ||
    !l.fornecedor ||
    !l.vencimento ||
    l.valor === null ||
    !l.situacao
  ) {
    return null;
  }
  return {
    id: l.id,
    competencia: l.competencia,
    servico_id: l.servico_id,
    tipo: l.tipo,
    fornecedor: l.fornecedor,
    descricao: l.descricao,
    loja_id: l.loja_id,
    vencimento: l.vencimento,
    valor: l.valor,
    situacao: l.situacao,
    data_pagamento: l.data_pagamento,
    id_aprovacao: l.id_aprovacao,
    aprovacao_ok: l.aprovacao_ok,
    observacao: l.observacao,
    anexo_path: l.anexo_path,
  };
}

async function Conteudo({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const filtros = lerFiltrosLancamentos(await searchParams);
  const [{ data, error }, lojas, servicos] = await Promise.all([
    buscarLancamentosDoMes(filtros),
    listarLojasOpcoes(),
    listarServicosFinanceirosOpcoes(),
  ]);

  if (error) {
    console.error("Erro ao listar lançamentos:", error);
    return <p className="text-destructive">Não foi possível carregar os lançamentos.</p>;
  }

  const filtrando = Boolean(
    filtros.tipo || filtros.situacao || filtros.vencimento || filtros.lojaId || filtros.busca,
  );
  const grupos = TIPOS_DESPESA.map((tipo) => ({
    tipo,
    linhas: data.filter((l) => l.tipo === tipo),
  })).filter((g) => g.linhas.length > 0);
  const competencia = competenciaDoMes(filtros.mes);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{formatarMes(filtros.mes)}</h2>
        <ResumoMes resumo={resumirLancamentos(data)} />
        <p className="text-xs text-muted-foreground">
          Cancelados ficam fora dos totais.
          {filtrando && " Totais calculados com os filtros aplicados."}
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Fornecedor / Descrição</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Situação do Vencimento</TableHead>
              <TableHead>ID da Aprovação</TableHead>
              <TableHead>Aprovação</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead>Anexo</TableHead>
              <TableHead className="w-0 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupos.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUNAS} className="py-8 text-center text-muted-foreground">
                  {filtrando
                    ? "Nenhum lançamento encontrado com esses filtros."
                    : "Nenhum lançamento neste mês."}
                </TableCell>
              </TableRow>
            )}
            {grupos.map(({ tipo, linhas }) => (
              <Fragment key={tipo}>
                {linhas.map((l, i) => {
                  const editavel = paraEdicao(l);
                  return (
                    <TableRow
                      key={l.id ?? i}
                      className={l.situacao === "cancelado" ? "opacity-60" : undefined}
                    >
                      {/* Tipo só na primeira linha do grupo, como célula mesclada da planilha. */}
                      {i === 0 && (
                        <TableCell rowSpan={linhas.length} className="align-top font-medium">
                          {TIPO_DESPESA_LABEL[tipo]}
                        </TableCell>
                      )}
                      <TableCell>
                        <NomeFinanceiro
                          fornecedor={l.fornecedor}
                          descricao={l.descricao}
                          identificador={l.servico_identificador}
                        />
                      </TableCell>
                      <TableCell>{l.loja_nome ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {l.vencimento ? formatarDataISO(l.vencimento) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.valor === null ? "—" : formatarMoeda(l.valor)}
                      </TableCell>
                      <TableCell>
                        <div className="leading-tight">
                          <SituacaoPagamentoBadge situacao={l.situacao} />
                          {l.data_pagamento && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Em {formatarDataISO(l.data_pagamento)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <SituacaoVencimentoBadge
                          situacao={l.situacao_vencimento}
                          dias={l.dias_para_vencer}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.id_aprovacao ?? "—"}</TableCell>
                      <TableCell>
                        <span
                          className={
                            l.aprovacao_ok === false
                              ? "font-medium text-destructive"
                              : l.aprovacao_ok === null
                                ? "text-muted-foreground"
                                : undefined
                          }
                        >
                          {rotuloAprovacao(l.aprovacao_ok)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-48">
                        {l.observacao ? (
                          <span className="block truncate" title={l.observacao}>
                            {l.observacao}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <LinkAnexoLancamento path={l.anexo_path} compacto />
                      </TableCell>
                      <TableCell>
                        {editavel && (
                          <div className="flex justify-end gap-1">
                            <SituacaoMenu
                              lancamento={{
                                id: editavel.id,
                                situacao: editavel.situacao,
                                nome: nomeFinanceiro({
                                  ...editavel,
                                  identificador: l.servico_identificador,
                                }),
                              }}
                            />
                            <LancamentoFormDialog
                              lojas={lojas}
                              servicos={servicos}
                              competenciaPadrao={competencia}
                              lancamento={editavel}
                              trigger={
                                <Button variant="ghost" size="sm">
                                  <PencilIcon />
                                  Editar<span className="sr-only"> {editavel.fornecedor}</span>
                                </Button>
                              }
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={4} className="text-right text-sm font-medium">
                    Subtotal {TIPO_DESPESA_LABEL[tipo]}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatarMoeda(somarValores(linhas))}
                  </TableCell>
                  <TableCell colSpan={COLUNAS - 5} />
                </TableRow>
              </Fragment>
            ))}
          </TableBody>
          {grupos.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatarMoeda(somarValores(data))}
                </TableCell>
                <TableCell colSpan={COLUNAS - 5} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {data.length >= LIMITE_LANCAMENTOS_MES && (
        <p className="text-sm text-amber-800 dark:text-amber-400">
          Mostrando os primeiros {LIMITE_LANCAMENTOS_MES} lançamentos. Use os filtros para
          refinar.
        </p>
      )}
    </div>
  );
}
