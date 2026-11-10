import {
  ArrowLeftIcon,
  ArrowRightLeftIcon,
  LinkIcon,
  PencilIcon,
  UndoIcon,
  UserRoundPlusIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { AnexarTermoButton } from "@/components/anexar-termo-button";
import { CampoDetalhe } from "@/components/campo-detalhe";
import {
  HistoricoVinculos,
  type LinhaHistorico,
} from "@/components/historico-vinculos";
import { LinkTermo } from "@/components/link-termo";
import { StatusDispositivoBadge } from "@/components/status-dispositivo-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listarColaboradoresAtivos } from "@/lib/colaboradores";
import { listarDispositivosVinculaveis } from "@/lib/dispositivos-vinculaveis";
import { descricaoDispositivo } from "@/lib/dispositivos";
import { formatarDataHora, formatarDuracao } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { TIPO_DISPOSITIVO_LABEL } from "@/lib/types";
import { formatarIMEI } from "@/lib/validators";

import { DevolverDialog } from "../devolver-dialog";
import { DispositivoFormDialog } from "../dispositivo-form-dialog";
import { StatusDialog } from "../status-dialog";
import { VincularDialog } from "../vincular-dialog";

export const metadata: Metadata = { title: "Detalhes do dispositivo" };

export default function DispositivoPage({
  params,
}: PageProps<"/dispositivos/[id]">) {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dispositivos">
          <ArrowLeftIcon />
          Dispositivos
        </Link>
      </Button>

      <Suspense fallback={<DetalheCarregando />}>
        <DetalheDispositivo params={params} />
      </Suspense>
    </div>
  );
}

async function DetalheDispositivo({
  params,
}: {
  params: PageProps<"/dispositivos/[id]">["params"];
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [dispositivoRes, vinculosRes, colaboradores, vinculaveis] = await Promise.all([
    supabase.from("dispositivos").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("vinculos")
      .select(
        "id, dispositivo_id, colaborador_id, data_inicio, data_fim, termo_path, observacao, observacao_devolucao, loja:lojas(nome), colaborador:colaboradores(id, nome, email, loja:lojas(nome))",
      )
      .eq("dispositivo_id", id)
      .order("data_inicio", { ascending: false })
      .order("created_at", { ascending: false }),
    listarColaboradoresAtivos(),
    listarDispositivosVinculaveis(),
  ]);

  if (dispositivoRes.error || vinculosRes.error) {
    console.error(
      "Erro ao carregar dispositivo:",
      dispositivoRes.error ?? vinculosRes.error,
    );
    return (
      <p className="text-destructive">Não foi possível carregar o dispositivo.</p>
    );
  }
  const d = dispositivoRes.data;
  if (!d) notFound();

  await connection(); // a duração usa o horário da requisição
  const agora = new Date();

  const vinculos = vinculosRes.data;
  const aberto = vinculos.find((v) => v.data_fim === null) ?? null;
  const descricao = descricaoDispositivo(d);
  const resumo = { id: d.id, descricao };

  const historico: LinhaHistorico[] = vinculos.map(
    ({ loja, colaborador, ...v }) => ({
      ...v,
      loja_nome: loja?.nome ?? null,
      colaborador: colaborador
        ? { id: colaborador.id, nome: colaborador.nome }
        : null,
    }),
  );

  // Loja do vínculo; avisa se o colaborador já mudou de filial.
  const lojaVinculo = aberto?.loja?.nome ?? null;
  const lojaAtualColaborador = aberto?.colaborador?.loja?.nome ?? null;

  const podeVincular = d.status === "disponivel" || d.status === "em_uso";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {d.marca} {d.modelo}
            </h1>
            <StatusDispositivoBadge status={d.status} />
          </div>
          <p className="text-muted-foreground">{TIPO_DISPOSITIVO_LABEL[d.tipo]}</p>
        </div>

        <div className="flex gap-2">
          <StatusDialog
            dispositivo={{
              id: d.id,
              descricao,
              status: d.status,
              colaboradorNome: aberto?.colaborador?.nome ?? null,
            }}
            trigger={
              <Button variant="outline">
                <ArrowRightLeftIcon />
                Status
              </Button>
            }
          />
          <DispositivoFormDialog
            dispositivo={d}
            trigger={
              <Button>
                <PencilIcon />
                Editar
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <CampoDetalhe rotulo="Tipo">{TIPO_DISPOSITIVO_LABEL[d.tipo]}</CampoDetalhe>
              <CampoDetalhe rotulo="Status">
                <StatusDispositivoBadge status={d.status} />
              </CampoDetalhe>
              <CampoDetalhe rotulo="Marca">{d.marca}</CampoDetalhe>
              <CampoDetalhe rotulo="Modelo">{d.modelo}</CampoDetalhe>
              {d.tipo === "telefone" && (
                <>
                  <CampoDetalhe rotulo="IMEI 1" mono>
                    {d.imei1 ? formatarIMEI(d.imei1) : "—"}
                  </CampoDetalhe>
                  <CampoDetalhe rotulo="IMEI 2" mono>
                    {d.imei2 ? formatarIMEI(d.imei2) : "—"}
                  </CampoDetalhe>
                </>
              )}
              {(d.tipo === "notebook" || d.serial_number) && (
                <CampoDetalhe rotulo="Serial Number" mono>
                  {d.serial_number ?? "—"}
                </CampoDetalhe>
              )}
              <CampoDetalhe rotulo="Cadastrado em">
                {formatarDataHora(d.created_at)}
              </CampoDetalhe>
              {d.observacao && (
                <div className="sm:col-span-2">
                  <CampoDetalhe rotulo="Observação">{d.observacao}</CampoDetalhe>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usuário atual</CardTitle>
            {aberto?.colaborador && (
              <CardAction className="flex gap-2">
                <VincularDialog
                  dispositivos={vinculaveis}
                  colaboradores={colaboradores}
                  dispositivoInicialId={d.id}
                  trigger={
                    <Button variant="outline" size="sm">
                      <ArrowRightLeftIcon />
                      Transferir
                    </Button>
                  }
                />
                <DevolverDialog
                  dispositivo={resumo}
                  colaboradorNome={aberto.colaborador.nome}
                  trigger={
                    <Button size="sm">
                      <UndoIcon />
                      Devolver
                    </Button>
                  }
                />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {aberto?.colaborador ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <CampoDetalhe rotulo="Nome">
                  <Link
                    href={`/colaboradores/${aberto.colaborador.id}`}
                    className="font-medium hover:underline"
                  >
                    {aberto.colaborador.nome}
                  </Link>
                </CampoDetalhe>
                <CampoDetalhe rotulo="Loja/Filial">
                  {lojaVinculo ?? "—"}
                  {lojaAtualColaborador && lojaAtualColaborador !== lojaVinculo && (
                    <span className="block text-sm text-muted-foreground">
                      Hoje em {lojaAtualColaborador}
                    </span>
                  )}
                </CampoDetalhe>
                <CampoDetalhe rotulo="E-mail">{aberto.colaborador.email}</CampoDetalhe>
                <CampoDetalhe rotulo="Desde">
                  {formatarDataHora(aberto.data_inicio)}
                  <span className="block text-sm text-muted-foreground">
                    há {formatarDuracao(aberto.data_inicio, agora)}
                  </span>
                </CampoDetalhe>
                <CampoDetalhe rotulo="Termo de responsabilidade">
                  {aberto.termo_path ? (
                    <LinkTermo path={aberto.termo_path} />
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">Sem termo</span>
                      <AnexarTermoButton
                        vinculoId={aberto.id}
                        dispositivoId={d.id}
                        colaboradorId={aberto.colaborador_id}
                        size="sm"
                      />
                    </span>
                  )}
                </CampoDetalhe>
                {aberto.observacao && (
                  <CampoDetalhe rotulo="Observação da entrega">
                    {aberto.observacao}
                  </CampoDetalhe>
                )}
              </dl>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <StatusDispositivoBadge status={d.status} />
                <p className="text-sm text-muted-foreground">
                  {podeVincular
                    ? "Nenhum usuário vinculado a este dispositivo."
                    : "Altere o status para Disponível para poder vincular."}
                </p>
                {podeVincular ? (
                  <VincularDialog
                    dispositivos={vinculaveis}
                    colaboradores={colaboradores}
                    dispositivoInicialId={d.id}
                    trigger={
                      <Button>
                        <UserRoundPlusIcon />
                        Vincular
                      </Button>
                    }
                  />
                ) : (
                  <Button disabled>
                    <LinkIcon />
                    Vincular
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de uso</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoricoVinculos contexto="dispositivo" linhas={historico} agora={agora} />
        </CardContent>
      </Card>
    </div>
  );
}

function DetalheCarregando() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando...">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
