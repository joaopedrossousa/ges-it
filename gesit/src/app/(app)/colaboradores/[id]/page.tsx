import { ArrowLeftIcon, PencilIcon, UserRoundPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { AnexarTermoButton } from "@/components/anexar-termo-button";
import { CampoDetalhe } from "@/components/campo-detalhe";
import { SecaoAlteracoes, SecaoAlteracoesCarregando } from "@/components/secao-alteracoes";
import { ExportarMenu } from "@/components/exportar";
import {
  HistoricoVinculos,
  type LinhaHistorico,
} from "@/components/historico-vinculos";
import { LinkTermo } from "@/components/link-termo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VincularDialog } from "@/app/(app)/dispositivos/vincular-dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { identificadorDispositivo } from "@/lib/dispositivos";
import { formatarDataHora, formatarDuracao } from "@/lib/format";
import { listarLojasOpcoes } from "@/lib/lojas";
import { createClient } from "@/lib/supabase/server";
import { TIPO_DISPOSITIVO_LABEL } from "@/lib/types";
import { formatarCPF } from "@/lib/validators";

import { ColaboradorFormDialog } from "../colaborador-form-dialog";
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
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [colaboradorRes, vinculosRes, lojas] = await Promise.all([
    supabase
      .from("colaboradores")
      .select(
        "id, nome, cargo, cpf, email, ativo, loja_id, created_at, updated_at, loja:lojas(nome)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("vinculos")
      .select(
        "id, dispositivo_id, colaborador_id, data_inicio, data_fim, termo_path, observacao, observacao_devolucao, perifericos_entrega, perifericos_devolucao, formatado_entrega, formatado_devolucao, loja:lojas(nome), dispositivo:dispositivos(id, tipo, marca, modelo, serial_number, imei1, numero_patrimonio)",
      )
      .eq("colaborador_id", id)
      .order("data_inicio", { ascending: false })
      .order("created_at", { ascending: false }),
    listarLojasOpcoes(),
  ]);

  if (colaboradorRes.error || vinculosRes.error) {
    console.error(
      "Erro ao carregar colaborador:",
      colaboradorRes.error ?? vinculosRes.error,
    );
    return (
      <p className="text-destructive">Não foi possível carregar o usuário.</p>
    );
  }
  const colaborador = colaboradorRes.data;
  if (!colaborador) notFound();

  const agora = new Date();

  const vinculos = vinculosRes.data;
  // Vínculos em aberto, com o dispositivo garantido (sem asserção não nula).
  const atuais = vinculos.flatMap(({ dispositivo, ...v }) =>
    v.data_fim === null && dispositivo ? [{ ...v, dispositivo }] : [],
  );

  const historico: LinhaHistorico[] = vinculos.map(
    ({ loja, dispositivo, ...v }) => ({
      ...v,
      tipo_dispositivo: dispositivo?.tipo ?? null,
      loja_nome: loja?.nome ?? null,
      dispositivo: dispositivo
        ? {
            id: dispositivo.id,
            descricao: `${dispositivo.marca} ${dispositivo.modelo}`,
            identificador: identificadorDispositivo(dispositivo),
          }
        : null,
    }),
  );

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
          <p className="text-muted-foreground">
            {[colaborador.cargo, colaborador.loja?.nome].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ExportarMenu relatorio="historico-usuario" params={{ id: colaborador.id }} />
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
            <CampoDetalhe rotulo="Nome">{colaborador.nome}</CampoDetalhe>
            <CampoDetalhe rotulo="Cargo">{colaborador.cargo ?? "—"}</CampoDetalhe>
            <CampoDetalhe rotulo="Loja/Filial">
              {colaborador.loja?.nome ?? "—"}
            </CampoDetalhe>
            <CampoDetalhe rotulo="CPF" mono>
              {formatarCPF(colaborador.cpf)}
            </CampoDetalhe>
            <CampoDetalhe rotulo="E-mail corporativo">{colaborador.email}</CampoDetalhe>
            <CampoDetalhe rotulo="Cadastrado em">
              {formatarDataHora(colaborador.created_at)}
            </CampoDetalhe>
            <CampoDetalhe rotulo="Atualizado em">
              {formatarDataHora(colaborador.updated_at)}
            </CampoDetalhe>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dispositivos atuais</CardTitle>
          <CardDescription>
            {atuais.length === 0
              ? "Nenhum dispositivo vinculado no momento."
              : `${atuais.length} ${atuais.length === 1 ? "dispositivo vinculado" : "dispositivos vinculados"}.`}
          </CardDescription>
          {colaborador.ativo && (
            <CardAction>
              <VincularDialog
                colaboradorInicial={{
                  id: colaborador.id,
                  nome: colaborador.nome,
                  cargo: colaborador.cargo,
                  email: colaborador.email,
                  loja_nome: colaborador.loja?.nome ?? null,
                }}
                trigger={
                  <Button variant="outline" size="sm">
                    <UserRoundPlusIcon />
                    Vincular dispositivo
                  </Button>
                }
              />
            </CardAction>
          )}
        </CardHeader>
        {atuais.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Termo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atuais.map((v) => {
                  const d = v.dispositivo;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>{TIPO_DISPOSITIVO_LABEL[d.tipo]}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/dispositivos/${d.id}`} className="hover:underline">
                          {d.marca} {d.modelo}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {identificadorDispositivo(d)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarDataHora(v.data_inicio)}
                        <span className="block text-xs text-muted-foreground">
                          há {formatarDuracao(v.data_inicio, agora)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {v.termo_path ? (
                          <LinkTermo path={v.termo_path} />
                        ) : (
                          <AnexarTermoButton
                            vinculoId={v.id}
                            dispositivoId={d.id}
                            colaboradorId={colaborador.id}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de uso</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoricoVinculos contexto="colaborador" linhas={historico} agora={agora} />
        </CardContent>
      </Card>

      <Suspense fallback={<SecaoAlteracoesCarregando />}>
        <SecaoAlteracoes tabela="colaboradores" registroId={colaborador.id} />
      </Suspense>
    </div>
  );
}

function DetalheCarregando() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando...">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
