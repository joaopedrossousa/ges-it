import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { TabelaCarregando } from "@/components/tabela-carregando";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { limparBusca, primeiro } from "@/lib/busca";
import { formatarDataHora } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { BuscaUsuarios } from "./busca";
import { NomeUsuarioDialog } from "./nome-usuario-dialog";

export const metadata: Metadata = { title: "Usuários" };

/** Minúsculas e sem acento, para a busca. */
const normalizar = (t: string) =>
  t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Administração > Usuários: quem faz login no sistema (Supabase Auth) e o
 * nome de exibição usado no lugar do e-mail. Criar e excluir usuários
 * continua sendo pelo painel do Supabase.
 */
export default function UsuariosSistemaPage({ searchParams }: PageProps<"/administracao/usuarios">) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground">
          Quem acessa o sistema. O nome de exibição aparece no lugar do e-mail. Para criar ou
          excluir um usuário, use o painel do Supabase.
        </p>
      </div>

      <Suspense fallback={<div className="h-9 max-w-sm animate-pulse rounded-lg bg-muted" />}>
        <BuscaUsuarios />
      </Suspense>

      <Suspense fallback={<TabelaCarregando colunas={4} />}>
        <TabelaUsuarios searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TabelaUsuarios({
  searchParams,
}: {
  searchParams: PageProps<"/administracao/usuarios">["searchParams"];
}) {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  const busca = limparBusca(primeiro((await searchParams).q) ?? "").slice(0, 100);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("usuarios_administracao");
  if (error) {
    console.error("Erro ao listar usuários do sistema:", error);
    return <p className="text-destructive">Não foi possível carregar os usuários.</p>;
  }

  const termo = normalizar(busca);
  const linhas = termo
    ? data.filter((u) =>
        normalizar(`${u.nome_exibicao ?? ""} ${u.nome_supabase ?? ""} ${u.email}`).includes(termo),
      )
    : data;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome de Exibição</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="w-0 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {busca ? "Nenhum usuário encontrado com essa busca." : "Nenhum usuário cadastrado."}
                </TableCell>
              </TableRow>
            )}
            {linhas.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.nome_exibicao ? (
                    u.nome_exibicao
                  ) : u.nome_supabase ? (
                    <span>
                      <span className="text-muted-foreground">{u.nome_supabase}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        Do cadastro do Supabase
                      </span>
                    </span>
                  ) : (
                    <span className="font-normal text-muted-foreground italic">Sem nome</span>
                  )}
                </TableCell>
                <TableCell className="max-w-72 truncate" title={u.email}>
                  {u.email}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {u.ultimo_acesso ? (
                    formatarDataHora(u.ultimo_acesso)
                  ) : (
                    <span className="text-muted-foreground">Nunca acessou</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <NomeUsuarioDialog
                      usuario={{
                        id: u.id,
                        email: u.email,
                        nomeExibicao: u.nome_exibicao,
                        nomeSupabase: u.nome_supabase,
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        {linhas.length} {linhas.length === 1 ? "usuário" : "usuários"}
        {busca && ` de ${data.length}`}.
      </p>
    </div>
  );
}
