import { ChevronRightIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

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
import {
  faixaDaPagina,
  limparBusca,
  paginaDoParametro,
  primeiro,
} from "@/lib/busca";
import { listarLojasOpcoes } from "@/lib/lojas";
import { createClient } from "@/lib/supabase/server";
import { mascararCPF, somenteDigitos } from "@/lib/validators";

import { ColaboradorFormDialog } from "./colaborador-form-dialog";
import { Filtros } from "./filtros";
import { StatusButton } from "./status-button";

export const metadata: Metadata = { title: "Usuários" };

type SearchParams = PageProps<"/colaboradores">["searchParams"];

export default function ColaboradoresPage({
  searchParams,
}: PageProps<"/colaboradores">) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
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
  const lojas = await listarLojasOpcoes();
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
      <Filtros lojas={lojas} />
      <ColaboradorFormDialog
        lojas={lojas}
        trigger={
          <Button className="self-start md:self-auto">
            <PlusIcon />
            Novo usuário
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
  const params = await searchParams;
  const busca = limparBusca(primeiro(params.q) ?? "").slice(0, 100);
  const lojaParam = primeiro(params.loja);
  const lojaId = z.uuid().safeParse(lojaParam).success ? lojaParam : undefined;

  const pagina = paginaDoParametro(primeiro(params.page));
  const { de, ate } = faixaDaPagina(pagina);

  const supabase = await createClient();
  let query = supabase
    .from("colaboradores")
    .select("id, nome, cpf, email, ativo, loja:lojas(nome)", { count: "exact" })
    .order("nome")
    .order("id") // desempate estável entre páginas
    .range(de, ate);

  if (lojaId) query = query.eq("loja_id", lojaId);

  if (busca) {
    const filtros = [`nome.ilike.%${busca}%`, `email.ilike.%${busca}%`];
    const digitos = somenteDigitos(busca);
    if (digitos.length >= 3) filtros.push(`cpf.like.%${digitos}%`);
    query = query.or(filtros.join(","));
  }

  const { data, count, error } = await query;

  if (error?.code === "PGRST103") {
    return <PaginaInexistente pathname="/colaboradores" params={params} />;
  }
  if (error) {
    console.error("Erro ao listar colaboradores:", error);
    return (
      <p className="text-destructive">Não foi possível carregar os usuários.</p>
    );
  }

  // O CPF completo nunca sai do servidor na listagem.
  const linhas = data.map(({ cpf, ...resto }) => ({
    ...resto,
    cpfMascarado: mascararCPF(cpf),
  }));

  const filtrando = Boolean(busca || lojaId);

  return (
    <div className="space-y-2">
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
                    ? "Nenhum usuário encontrado com esses filtros."
                    : "Nenhum usuário cadastrado."}
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
                </TableCell>
                <TableCell>{c.loja?.nome ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{c.cpfMascarado}</TableCell>
                <TableCell>{c.email}</TableCell>
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
                        Detalhes
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
        total={count ?? linhas.length}
        rotulo={["usuário", "usuários"]}
      />
    </div>
  );
}
