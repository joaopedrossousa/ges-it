import { PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { TabelaCarregando } from "@/components/tabela-carregando";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TIPO_DESPESA_LABEL } from "@/lib/financeiro";
import { lerFiltrosServicosFinanceiros } from "@/lib/filtros-financeiro";
import { formatarMoeda } from "@/lib/format";
import { listarLojasOpcoes } from "@/lib/lojas";
import { createClient } from "@/lib/supabase/server";

import { FiltrosServicos } from "./filtros";
import { ServicoFinanceiroFormDialog } from "./servico-financeiro-form-dialog";

export const metadata: Metadata = { title: "Serviços e fornecedores" };

export default function ServicosFinanceirosPage({
  searchParams,
}: PageProps<"/financeiro/servicos">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Serviços e fornecedores</h1>
          <p className="text-muted-foreground">
            Catálogo das despesas recorrentes, usado para preencher os lançamentos do mês.
          </p>
        </div>
        <Suspense
          fallback={
            <Button disabled>
              <PlusIcon />
              Novo serviço
            </Button>
          }
        >
          <NovoServico />
        </Suspense>
      </div>

      <Suspense fallback={<div className="h-8" />}>
        <FiltrosServicos />
      </Suspense>

      <Suspense fallback={<TabelaCarregando colunas={8} />}>
        <TabelaServicos searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** O formulário precisa das lojas (filial). */
async function NovoServico() {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  const lojas = await listarLojasOpcoes();
  return (
    <ServicoFinanceiroFormDialog
      lojas={lojas}
      trigger={
        <Button>
          <PlusIcon />
          Novo serviço
        </Button>
      }
    />
  );
}

async function TabelaServicos({
  searchParams,
}: {
  searchParams: PageProps<"/financeiro/servicos">["searchParams"];
}) {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  const { tipo, ativo } = lerFiltrosServicosFinanceiros(await searchParams);

  const supabase = await createClient();
  let q = supabase
    .from("servicos_financeiros")
    .select(
      "id, tipo, descricao, fornecedor, identificador, loja_id, dia_vencimento, valor_referencia, ativo, observacao",
    )
    .order("ativo", { ascending: false })
    .order("tipo")
    .order("descricao")
    .order("id");
  if (tipo) q = q.eq("tipo", tipo);
  if (ativo !== undefined) q = q.eq("ativo", ativo);

  const [{ data, error }, lojas] = await Promise.all([q, listarLojasOpcoes()]);

  if (error) {
    console.error("Erro ao listar serviços financeiros:", error);
    return <p className="text-destructive">Não foi possível carregar os serviços.</p>;
  }

  const nomesLojas = new Map(lojas.map((l) => [l.id, l.nome]));
  const filtrando = Boolean(tipo || ativo !== undefined);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição / identificador</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Filial</TableHead>
            <TableHead className="text-right">Dia de venc.</TableHead>
            <TableHead className="text-right">Valor de referência</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-0 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                {filtrando
                  ? "Nenhum serviço encontrado com esses filtros."
                  : "Nenhum serviço cadastrado."}
              </TableCell>
            </TableRow>
          )}
          {data.map((s) => (
            <TableRow key={s.id} className={s.ativo ? undefined : "opacity-60"}>
              <TableCell>{TIPO_DESPESA_LABEL[s.tipo]}</TableCell>
              <TableCell>
                <div className="leading-tight">
                  <div className="font-medium">{s.descricao}</div>
                  {s.identificador && (
                    <div className="text-xs text-muted-foreground">{s.identificador}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>{s.fornecedor ?? "—"}</TableCell>
              <TableCell>{(s.loja_id && nomesLojas.get(s.loja_id)) ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{s.dia_vencimento ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">
                {s.valor_referencia === null ? "—" : formatarMoeda(s.valor_referencia)}
              </TableCell>
              <TableCell>
                <Badge variant={s.ativo ? "secondary" : "outline"}>
                  {s.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <ServicoFinanceiroFormDialog
                  lojas={lojas}
                  servico={s}
                  trigger={
                    <Button variant="ghost" size="sm">
                      <PencilIcon />
                      Editar<span className="sr-only"> {s.descricao}</span>
                    </Button>
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
