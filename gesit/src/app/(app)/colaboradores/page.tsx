import { ChevronRightIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { DadosPendentesBadge } from "@/components/dados-pendentes-badge";
import { ExportarMenu } from "@/components/exportar";
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
import { Paginacao, PaginaInexistente } from "@/components/paginacao";
import { faixaDaPagina, paginaDoParametro, primeiro } from "@/lib/busca";
import { descreverPendencias, SITUACAO_PADRAO } from "@/lib/colaboradores";
import { condicoesColaboradores, lerFiltrosColaboradores } from "@/lib/filtros-colaboradores";
import { listarLojasOpcoes } from "@/lib/lojas";
import { createClient } from "@/lib/supabase/server";
import { contar } from "@/lib/relatorios/tipos";
import { mascararCPF } from "@/lib/validators";

import { ColaboradorFormDialog } from "./colaborador-form-dialog";
import { Filtros } from "./filtros";
import { StatusButton } from "./status-button";

export const metadata: Metadata = { title: "Colaboradores" };

type SearchParams = PageProps<"/colaboradores">["searchParams"];

export default function ColaboradoresPage({
  searchParams,
}: PageProps<"/colaboradores">) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Colaboradores</h1>
        <p className="text-muted-foreground">
          Pessoas que podem receber dispositivos.
        </p>
      </div>

      <Suspense fallback={<div className="h-8" />}>
        <BarraDeFerramentas />
      </Suspense>

      <Suspense fallback={<TabelaCarregando colunas={6} />}>
        <TabelaColaboradores searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BarraDeFerramentas() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const lojas = await listarLojasOpcoes();
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
      <Filtros lojas={lojas} />
      <ColaboradorFormDialog
        lojas={lojas}
        trigger={
          <Button className="self-start md:self-auto">
            <PlusIcon />
            Novo colaborador
          </Button>
        }
      />
    </div>
  );
}

async function TabelaColaboradores({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const params = await searchParams;
  const filtros = lerFiltrosColaboradores(params);
  const { ativo, lojaId, ou } = condicoesColaboradores(filtros);

  const pagina = paginaDoParametro(primeiro(params.page));
  const { de, ate } = faixaDaPagina(pagina);

  const supabase = await createClient();
  let query = supabase
    .from("colaboradores")
    .select("id, nome, cargo, cpf, email, ativo, loja:lojas(nome)", { count: "exact" })
    .order("nome")
    .order("id") // desempate estável entre páginas
    .range(de, ate);

  if (ativo !== undefined) query = query.eq("ativo", ativo);
  if (lojaId) query = query.eq("loja_id", lojaId);
  if (ou) query = query.or(ou);

  const { data, count, error } = await query;

  if (error?.code === "PGRST103") {
    return <PaginaInexistente pathname="/colaboradores" params={params} />;
  }
  if (error) {
    console.error("Erro ao listar colaboradores:", error);
    return (
      <p className="text-destructive">Não foi possível carregar os colaboradores.</p>
    );
  }

  // O CPF completo nunca sai do servidor na listagem.
  const linhas = data.map(({ cpf, ...resto }) => ({
    ...resto,
    cpfMascarado: mascararCPF(cpf),
    pendencias: descreverPendencias({ cpf, email: resto.email }),
  }));

  const total = count ?? linhas.length;
  const filtrando = Boolean(filtros.busca || lojaId || filtros.situacao !== SITUACAO_PADRAO);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {contar(total, "colaborador", "colaboradores")}
          {filtrando && " (com os filtros aplicados)"}.
        </p>
        {/* Mesmos filtros da tela; a situação vai sempre explícita (vira o nome do arquivo). */}
        <ExportarMenu
          relatorio="colaboradores"
          params={{
            q: filtros.busca || undefined,
            loja: lojaId,
            situacao: filtros.situacao,
          }}
          desabilitado={total === 0}
          dica="Nenhum colaborador para exportar com esses filtros"
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Loja/Filial</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  {filtrando
                    ? "Nenhum colaborador encontrado com esses filtros."
                    : "Nenhum colaborador ativo cadastrado."}
                </TableCell>
              </TableRow>
            )}
            {linhas.map((c) => (
              <TableRow key={c.id} className={c.ativo ? undefined : "opacity-60"}>
                <TableCell className="font-medium">
                  <Link
                    href={`/colaboradores/${c.id}`}
                    className="hover:underline"
                  >
                    {c.nome}
                  </Link>
                  {c.cargo && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {c.cargo}
                    </span>
                  )}
                  {c.pendencias && (
                    <span className="mt-1 block">
                      <DadosPendentesBadge detalhe={c.pendencias} />
                    </span>
                  )}
                </TableCell>
                <TableCell>{c.loja?.nome ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{c.cpfMascarado}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.ativo ? "secondary" : "outline"}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <StatusButton id={c.id} nome={c.nome} ativo={c.ativo} />
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/colaboradores/${c.id}`}>
                        Detalhes<span className="sr-only"> de {c.nome}</span>
                        <ChevronRightIcon />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Paginacao
        pathname="/colaboradores"
        params={params}
        pagina={pagina}
        total={total}
        rotulo={["colaborador", "colaboradores"]}
      />
    </div>
  );
}
