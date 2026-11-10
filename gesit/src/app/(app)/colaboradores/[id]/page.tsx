import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatarDataHora } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { formatarCPF } from "@/lib/validators";

import { ColaboradorFormDialog } from "../colaborador-form-dialog";
import { listarLojasOpcoes } from "@/lib/lojas";
import { StatusButton } from "../status-button";

export const metadata: Metadata = { title: "Detalhes do usuário" };

export default function ColaboradorPage({
  params,
}: PageProps<"/colaboradores/[id]">) {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/colaboradores">
          <ArrowLeftIcon />
          Usuários
        </Link>
      </Button>

      <Suspense fallback={<DetalheCarregando />}>
        <DetalheColaborador params={params} />
      </Suspense>
    </div>
  );
}

async function DetalheColaborador({
  params,
}: {
  params: PageProps<"/colaboradores/[id]">["params"];
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: colaborador, error }, lojas] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("id, nome, cpf, email, ativo, loja_id, created_at, updated_at, loja:lojas(nome)")
      .eq("id", id)
      .maybeSingle(),
    listarLojasOpcoes(),
  ]);

  if (error) {
    console.error("Erro ao carregar colaborador:", error);
    return (
      <p className="text-destructive">Não foi possível carregar o usuário.</p>
    );
  }
  if (!colaborador) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {colaborador.nome}
            </h1>
            <Badge variant={colaborador.ativo ? "secondary" : "outline"}>
              {colaborador.ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="text-muted-foreground">{colaborador.loja?.nome}</p>
        </div>

        <div className="flex gap-2">
          <StatusButton
            id={colaborador.id}
            nome={colaborador.nome}
            ativo={colaborador.ativo}
            size="default"
          />
          <ColaboradorFormDialog
            lojas={lojas}
            colaborador={colaborador}
            trigger={
              <Button>
                <PencilIcon />
                Editar
              </Button>
            }
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome" valor={colaborador.nome} />
            <Campo rotulo="Loja/Filial" valor={colaborador.loja?.nome ?? "—"} />
            <Campo rotulo="CPF" valor={formatarCPF(colaborador.cpf)} mono />
            <Campo rotulo="E-mail corporativo" valor={colaborador.email} />
            <Campo
              rotulo="Cadastrado em"
              valor={formatarDataHora(colaborador.created_at)}
            />
            <Campo
              rotulo="Atualizado em"
              valor={formatarDataHora(colaborador.updated_at)}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  mono,
}: {
  rotulo: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className={mono ? "font-mono" : undefined}>{valor}</dd>
    </div>
  );
}

function DetalheCarregando() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando...">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
