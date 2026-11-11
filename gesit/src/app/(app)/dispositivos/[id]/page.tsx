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
import { SecaoAlteracoes, SecaoAlteracoesCarregando } from "@/components/secao-alteracoes";
import { ExportarMenu } from "@/components/exportar";
import {
  HistoricoVinculos,
  type LinhaHistorico,
} from "@/components/historico-vinculos";
import { LinkNotaFiscal } from "@/components/link-nota-fiscal";
import { LinkTermo } from "@/components/link-termo";
import { StatusDispositivoBadge } from "@/components/status-dispositivo-badge";
import { VidaUtilBadge } from "@/components/vida-util-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { descricaoDispositivo, identificadorDispositivo } from "@/lib/dispositivos";
import type { DispositivoOpcao } from "@/lib/opcoes-vinculo";
import {
  formatarDataHora,
  formatarDataISO,
  formatarDuracao,
  formatarIdadeMeses,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { TIPO_DISPOSITIVO_LABEL } from "@/lib/types";
import { formatarIMEI, formatarLinha } from "@/lib/validators";

import { DevolverDialog } from "../devolver-dialog";
import { HistoricoServicos } from "./historico-servicos";
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
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [dispositivoRes, vidaUtilRes, vinculosRes, servicosRes] = await Promise.all([
    supabase.from("dispositivos").select("*").eq("id", id).maybeSingle(),
    // Idade e situação da vida útil: calculadas na view (data de Palmas).
    supabase
      .from("vw_dispositivos")
      .select("idade_meses, situacao_vida_util")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("vinculos")
      .select(
        "id, dispositivo_id, colaborador_id, data_inicio, data_fim, termo_path, observacao, observacao_devolucao, perifericos_entrega, perifericos_devolucao, formatado_entrega, formatado_devolucao, loja:lojas(nome), colaborador:colaboradores(id, nome, email, loja:lojas(nome))",
      )
      .eq("dispositivo_id", id)
      .order("data_inicio", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("servicos")
      .select("*")
      .eq("dispositivo_id", id)
      .order("data_servico", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (dispositivoRes.error || vidaUtilRes.error || vinculosRes.error || servicosRes.error) {
    console.error(
      "Erro ao carregar dispositivo:",
      dispositivoRes.error ?? vidaUtilRes.error ?? vinculosRes.error ?? servicosRes.error,
    );
    return (
      <p className="text-destructive">Não foi possível carregar o dispositivo.</p>
    );
  }
  const d = dispositivoRes.data;
  if (!d) notFound();

  const agora = new Date();
  const idadeMeses = vidaUtilRes.data?.idade_meses ?? null;
  const situacaoVidaUtil = vidaUtilRes.data?.situacao_vida_util ?? null;

  const vinculos = vinculosRes.data;
  const aberto = vinculos.find((v) => v.data_fim === null) ?? null;
  const descricao = descricaoDispositivo(d);
  const resumo = { id: d.id, descricao, tipo: d.tipo };

  const historico: LinhaHistorico[] = vinculos.map(
    ({ loja, colaborador, ...v }) => ({
      ...v,
      tipo_dispositivo: d.tipo,
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

  // Pré-seleção do diálogo de vincular/transferir.
  const opcaoDispositivo: DispositivoOpcao = {
    id: d.id,
    tipo: d.tipo,
    marca: d.marca,
    modelo: d.modelo,
    identificador: identificadorDispositivo(d),
    status: d.status,
    colaborador_id: aberto?.colaborador_id ?? null,
    colaborador_nome: aberto?.colaborador?.nome ?? null,
  };

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

        <div className="flex flex-wrap gap-2">
          <ExportarMenu relatorio="historico-dispositivo" params={{ id: d.id }} />
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
              <CampoDetalhe rotulo="Nº de patrimônio" mono>
                {d.numero_patrimonio ?? "—"}
              </CampoDetalhe>
              {(d.tipo === "notebook" || d.serial_number) && (
                <CampoDetalhe rotulo="Serial Number" mono>
                  {d.serial_number ?? "—"}
                </CampoDetalhe>
              )}
              {d.tipo === "telefone" && (
                <>
                  <CampoDetalhe rotulo="IMEI 1" mono>
                    {d.imei1 ? formatarIMEI(d.imei1) : "—"}
                  </CampoDetalhe>
                  <CampoDetalhe rotulo="IMEI 2" mono>
                    {d.imei2 ? formatarIMEI(d.imei2) : "—"}
                  </CampoDetalhe>
                  <CampoDetalhe rotulo="Número da linha">
                    {d.numero_linha ? formatarLinha(d.numero_linha) : "—"}
                  </CampoDetalhe>
                  <CampoDetalhe rotulo="Operadora">{d.operadora ?? "—"}</CampoDetalhe>
                </>
              )}
              <CampoDetalhe rotulo="Data de compra">
                {d.data_compra ? formatarDataISO(d.data_compra) : "—"}
              </CampoDetalhe>
              <CampoDetalhe rotulo="Idade">
                {idadeMeses !== null ? formatarIdadeMeses(idadeMeses) : "—"}
              </CampoDetalhe>
              <CampoDetalhe rotulo="Fim da vida útil">
                <span className="flex flex-wrap items-center gap-2">
                  {d.fim_vida_util && formatarDataISO(d.fim_vida_util)}
                  {/* Baixado: o badge vira "—"; com data, basta a data. */}
                  {(situacaoVidaUtil !== "baixado" || !d.fim_vida_util) && (
                    <VidaUtilBadge situacao={situacaoVidaUtil} />
                  )}
                </span>
              </CampoDetalhe>
              <CampoDetalhe rotulo="Nota fiscal">
                <LinkNotaFiscal path={d.nota_fiscal_path} />
              </CampoDetalhe>
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
                  dispositivoInicial={opcaoDispositivo}
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
                  perifericosEntregues={aberto.perifericos_entrega}
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
                <CampoDetalhe rotulo="E-mail">{aberto.colaborador.email ?? "—"}</CampoDetalhe>
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
                    dispositivoInicial={opcaoDispositivo}
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

      <HistoricoServicos dispositivoId={d.id} servicos={servicosRes.data} />

      <Suspense fallback={<SecaoAlteracoesCarregando />}>
        <SecaoAlteracoes tabela="dispositivos" registroId={d.id} />
      </Suspense>
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
