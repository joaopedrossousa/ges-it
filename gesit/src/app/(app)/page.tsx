import {
  ArrowRightLeftIcon,
  CircleCheckIcon,
  FileWarningIcon,
  LaptopIcon,
  SmartphoneIcon,
  UndoIcon,
  UserRoundCheckIcon,
  UserRoundPlusIcon,
  WrenchIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { AnexarTermoButton } from "@/components/anexar-termo-button";
import { StatTile, StatTileCarregando } from "@/components/stat-tile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { identificadorDispositivo } from "@/lib/dispositivos";
import { formatarDataHora, formatarDuracao } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { StatusDispositivo, TipoDispositivo } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da gestão de ativos de T.I.</p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <StatTileCarregando key={i} />
            ))}
          </div>
        }
      >
        <Indicadores />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<CardCarregando titulo="Vínculos sem termo" />}>
          <VinculosSemTermo />
        </Suspense>
        <Suspense fallback={<CardCarregando titulo="Últimas movimentações" />}>
          <UltimasMovimentacoes />
        </Suspense>
      </div>
    </div>
  );
}

// ===========================================================================
// Indicadores
// ===========================================================================

const TIPOS: TipoDispositivo[] = ["notebook", "telefone"];
const STATUS: StatusDispositivo[] = ["disponivel", "em_uso", "manutencao", "baixado"];

type Contagem = Record<TipoDispositivo, Record<StatusDispositivo, number>>;

/**
 * Conta no banco (count exact, sem trazer linhas) cada combinação tipo × status.
 * Contar no JS seria limitado pelo máximo de linhas por resposta do PostgREST.
 */
async function contarDispositivos(): Promise<Contagem | null> {
  const supabase = await createClient();
  const pares = TIPOS.flatMap((tipo) => STATUS.map((status) => ({ tipo, status })));

  const resultados = await Promise.all(
    pares.map(({ tipo, status }) =>
      supabase
        .from("dispositivos")
        .select("id", { count: "exact", head: true })
        .eq("tipo", tipo)
        .eq("status", status),
    ),
  );

  const erro = resultados.find((r) => r.error)?.error;
  if (erro) {
    console.error("Erro ao contar dispositivos:", erro);
    return null;
  }

  const contagem = {
    notebook: { disponivel: 0, em_uso: 0, manutencao: 0, baixado: 0 },
    telefone: { disponivel: 0, em_uso: 0, manutencao: 0, baixado: 0 },
  } satisfies Contagem;
  pares.forEach(({ tipo, status }, i) => {
    contagem[tipo][status] = resultados[i].count ?? 0;
  });
  return contagem;
}

function porTipo(c: Contagem, status: StatusDispositivo) {
  const n = c.notebook[status];
  const t = c.telefone[status];
  return `${n} ${n === 1 ? "notebook" : "notebooks"} · ${t} ${t === 1 ? "telefone" : "telefones"}`;
}

async function Indicadores() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const c = await contarDispositivos();
  if (!c) {
    return <p className="text-destructive">Não foi possível carregar os indicadores.</p>;
  }

  // Totais da frota em operação: baixados ficam fora (aparecem no detalhe).
  const total = (tipo: TipoDispositivo) =>
    c[tipo].disponivel + c[tipo].em_uso + c[tipo].manutencao;
  const baixados = (tipo: TipoDispositivo) =>
    c[tipo].baixado > 0 ? `sem contar ${c[tipo].baixado} baixado${c[tipo].baixado === 1 ? "" : "s"}` : "em operação";

  return (
    <section aria-label="Indicadores" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile
        rotulo="Notebooks"
        valor={total("notebook")}
        icone={LaptopIcon}
        detalhe={baixados("notebook")}
        href="/dispositivos?tipo=notebook"
      />
      <StatTile
        rotulo="Telefones"
        valor={total("telefone")}
        icone={SmartphoneIcon}
        detalhe={baixados("telefone")}
        href="/dispositivos?tipo=telefone"
      />
      <StatTile
        rotulo="Em uso"
        valor={c.notebook.em_uso + c.telefone.em_uso}
        icone={UserRoundCheckIcon}
        corIcone="text-brand-blue dark:text-primary"
        detalhe={porTipo(c, "em_uso")}
        href="/dispositivos?status=em_uso"
      />
      <StatTile
        rotulo="Disponíveis"
        valor={c.notebook.disponivel + c.telefone.disponivel}
        icone={CircleCheckIcon}
        corIcone="text-brand-green"
        detalhe={porTipo(c, "disponivel")}
        href="/dispositivos?status=disponivel"
      />
      <StatTile
        rotulo="Em manutenção"
        valor={c.notebook.manutencao + c.telefone.manutencao}
        icone={WrenchIcon}
        corIcone="text-amber-600 dark:text-amber-400"
        detalhe={porTipo(c, "manutencao")}
        href="/dispositivos?status=manutencao"
      />
    </section>
  );
}

// ===========================================================================
// Vínculos sem termo
// ===========================================================================

const LIMITE_SEM_TERMO = 30;

async function VinculosSemTermo() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const supabase = await createClient();
  // Só vínculos abertos: são os que exigem ação (o termo do responsável atual).
  const { data, count, error } = await supabase
    .from("vinculos")
    .select(
      "id, dispositivo_id, colaborador_id, data_inicio, loja:lojas(nome), colaborador:colaboradores(nome), dispositivo:dispositivos(tipo, marca, modelo, serial_number, imei1)",
      { count: "exact" },
    )
    .is("termo_path", null)
    .is("data_fim", null)
    .order("data_inicio", { ascending: true }) // há mais tempo sem termo primeiro
    .limit(LIMITE_SEM_TERMO);

  if (error) {
    console.error("Erro ao listar vínculos sem termo:", error);
    return (
      <CardSimples titulo="Vínculos sem termo">
        <p className="text-destructive">Não foi possível carregar os vínculos.</p>
      </CardSimples>
    );
  }

  const agora = new Date();
  const total = count ?? data.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileWarningIcon
            className={total > 0 ? "size-4 text-amber-600 dark:text-amber-400" : "size-4 text-muted-foreground"}
            aria-hidden
          />
          Vínculos sem termo
        </CardTitle>
        <CardDescription>
          {total === 0
            ? "Todos os vínculos em aberto têm termo anexado."
            : `${total} ${total === 1 ? "vínculo em aberto" : "vínculos em aberto"} sem termo de responsabilidade.`}
        </CardDescription>
      </CardHeader>
      {total > 0 && (
        <CardContent>
          <ul className="divide-y">
            {data.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 text-sm">
                  <Link
                    href={`/dispositivos/${v.dispositivo_id}`}
                    className="font-medium hover:underline"
                  >
                    {v.dispositivo ? `${v.dispositivo.marca} ${v.dispositivo.modelo}` : "Dispositivo"}
                  </Link>
                  {v.dispositivo && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {identificadorDispositivo(v.dispositivo)}
                    </span>
                  )}
                  <p className="text-muted-foreground">
                    <Link href={`/colaboradores/${v.colaborador_id}`} className="hover:underline">
                      {v.colaborador?.nome ?? "—"}
                    </Link>
                    {v.loja?.nome && ` · ${v.loja.nome}`} · há{" "}
                    {formatarDuracao(v.data_inicio, agora)}
                  </p>
                </div>
                <AnexarTermoButton
                  vinculoId={v.id}
                  dispositivoId={v.dispositivo_id}
                  colaboradorId={v.colaborador_id}
                />
              </li>
            ))}
          </ul>
          {total > data.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              Mostrando os {data.length} mais antigos de {total}.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ===========================================================================
// Últimas movimentações
// ===========================================================================

const LIMITE_MOVIMENTACOES = 10;

const SELECT_MOVIMENTACAO =
  "id, dispositivo_id, colaborador_id, data_inicio, data_fim, observacao_devolucao, loja:lojas(nome), colaborador:colaboradores(nome), dispositivo:dispositivos(marca, modelo)";

/** Texto gravado por vincular_dispositivo ao encerrar o vínculo anterior. */
const ENCERRADO_POR_TRANSFERENCIA = "Encerrado por transferência";

type TipoEvento = "entrega" | "devolucao" | "transferencia";

const EVENTO: Record<TipoEvento, { rotulo: string; icone: typeof UndoIcon; preposicao: string }> = {
  entrega: { rotulo: "Entrega", icone: UserRoundPlusIcon, preposicao: "para" },
  devolucao: { rotulo: "Devolução", icone: UndoIcon, preposicao: "de" },
  transferencia: { rotulo: "Saída por transferência", icone: ArrowRightLeftIcon, preposicao: "de" },
};

async function UltimasMovimentacoes() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const supabase = await createClient();

  // Movimentação = vínculo criado (data_inicio) ou encerrado (data_fim).
  // Busca as 10 mais recentes de cada lado e intercala.
  const [criados, encerrados] = await Promise.all([
    supabase
      .from("vinculos")
      .select(SELECT_MOVIMENTACAO)
      .order("data_inicio", { ascending: false })
      .limit(LIMITE_MOVIMENTACOES),
    supabase
      .from("vinculos")
      .select(SELECT_MOVIMENTACAO)
      .not("data_fim", "is", null)
      .order("data_fim", { ascending: false })
      .limit(LIMITE_MOVIMENTACOES),
  ]);

  if (criados.error || encerrados.error) {
    console.error("Erro ao listar movimentações:", criados.error ?? encerrados.error);
    return (
      <CardSimples titulo="Últimas movimentações">
        <p className="text-destructive">Não foi possível carregar as movimentações.</p>
      </CardSimples>
    );
  }

  type Evento = {
    v: (typeof criados.data)[number];
    tipo: TipoEvento;
    quando: string;
    ordem: number;
  };

  const entregas: Evento[] = criados.data.map((v) => ({
    v,
    tipo: "entrega",
    quando: v.data_inicio,
    ordem: 1,
  }));
  const saidas: Evento[] = encerrados.data.flatMap((v) =>
    v.data_fim
      ? [
          {
            v,
            tipo:
              v.observacao_devolucao === ENCERRADO_POR_TRANSFERENCIA
                ? "transferencia"
                : "devolucao",
            quando: v.data_fim,
            ordem: 0,
          },
        ]
      : [],
  );

  const eventos = [...entregas, ...saidas]
    // Mais recente primeiro; no mesmo instante (transferência), a entrega vem antes.
    .sort((a, b) => b.quando.localeCompare(a.quando) || b.ordem - a.ordem)
    .slice(0, LIMITE_MOVIMENTACOES);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimas movimentações</CardTitle>
        <CardDescription>Entregas e devoluções mais recentes.</CardDescription>
      </CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <ol className="divide-y">
            {eventos.map(({ v, tipo, quando }) => {
              const { rotulo, icone: Icone, preposicao } = EVENTO[tipo];
              return (
                <li key={`${tipo}-${v.id}`} className="flex gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                  <Icone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-medium">{rotulo}</span>{" "}
                      <Link href={`/dispositivos/${v.dispositivo_id}`} className="hover:underline">
                        {v.dispositivo ? `${v.dispositivo.marca} ${v.dispositivo.modelo}` : "dispositivo"}
                      </Link>{" "}
                      {preposicao}{" "}
                      <Link href={`/colaboradores/${v.colaborador_id}`} className="hover:underline">
                        {v.colaborador?.nome ?? "—"}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatarDataHora(quando)}
                      {v.loja?.nome && ` · ${v.loja.nome}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Auxiliares
// ===========================================================================

function CardSimples({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CardCarregando({ titulo }: { titulo: string }) {
  return (
    <CardSimples titulo={titulo}>
      <div className="space-y-3" role="status" aria-label="Carregando...">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </CardSimples>
  );
}
