import {
  ArrowRightLeftIcon,
  CalendarClockIcon,
  CalendarOffIcon,
  CalendarX2Icon,
  CircleCheckIcon,
  FileWarningIcon,
  HourglassIcon,
  LaptopIcon,
  MonitorIcon,
  SmartphoneIcon,
  UndoIcon,
  UserRoundCheckIcon,
  UserRoundPlusIcon,
  UserRoundXIcon,
  WrenchIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { AnexarTermoButton } from "@/components/anexar-termo-button";
import {
  GraficoAtivosFilial,
  LegendaAtivosFilial,
  type BarraFilial,
} from "@/components/grafico-ativos-filial";
import { StatTile, StatTileCarregando } from "@/components/stat-tile";
import { VidaUtilBadge } from "@/components/vida-util-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { descreverPendencias, FILTRO_DADOS_PENDENTES } from "@/lib/colaboradores";
import { identificadorDispositivo } from "@/lib/dispositivos";
import { listarLojasOpcoes } from "@/lib/lojas";
import {
  formatarDataHora,
  formatarDataISO,
  formatarDuracao,
  formatarPrazo,
  hojeEmPalmas,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  TIPO_DISPOSITIVO_PLURAL,
  type SituacaoVidaUtil,
  type StatusDispositivo,
  type TipoDispositivo,
} from "@/lib/types";

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
          <div className={GRADE_INDICADORES}>
            {Array.from({ length: 6 }, (_, i) => (
              <StatTileCarregando key={i} />
            ))}
          </div>
        }
      >
        <Indicadores />
      </Suspense>

      <section aria-label="Vida útil" className="grid gap-6 lg:grid-cols-3">
        <Suspense
          fallback={
            <div className={GRADE_VIDA_UTIL}>
              {Array.from({ length: 3 }, (_, i) => (
                <StatTileCarregando key={i} />
              ))}
            </div>
          }
        >
          <IndicadoresVidaUtil />
        </Suspense>
        <div className="lg:col-span-2">
          <Suspense fallback={<CardCarregando titulo="Próximos da troca" />}>
            <ProximosDaTroca />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="ativos-por-filial" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-1">
            <h2 id="ativos-por-filial" className="text-lg font-semibold tracking-tight">
              Ativos por filial
            </h2>
            <p className="text-sm text-muted-foreground">
              Sem os baixados. Em estoque inclui os em manutenção, na filial de estoque. Clique numa
              barra para ver os aparelhos.
            </p>
          </div>
          <LegendaAtivosFilial />
        </div>
        <Suspense
          fallback={
            <div className={GRADE_GRAFICOS}>
              {TIPOS.map((t) => (
                <div key={t} className="h-80 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          }
        >
          <AtivosPorFilial />
        </Suspense>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Esquerda: o que pede ação; direita: o histórico recente. */}
        <div className="grid gap-6">
          <Suspense fallback={<CardCarregando titulo="Vínculos sem termo" />}>
            <VinculosSemTermo />
          </Suspense>
          <Suspense fallback={<CardCarregando titulo="Usuários com dados pendentes" />}>
            <UsuariosComDadosPendentes />
          </Suspense>
        </div>
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

const GRADE_INDICADORES = "grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6";

const TIPOS: TipoDispositivo[] = ["notebook", "telefone", "monitor"];
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
    monitor: { disponivel: 0, em_uso: 0, manutencao: 0, baixado: 0 },
  } satisfies Contagem;
  pares.forEach(({ tipo, status }, i) => {
    contagem[tipo][status] = resultados[i].count ?? 0;
  });
  return contagem;
}

/** Ex.: "3 notebooks · 1 telefone" (tipos zerados ficam de fora). */
function porTipo(c: Contagem, status: StatusDispositivo) {
  const partes = TIPOS.filter((tipo) => c[tipo][status] > 0).map((tipo) => {
    const n = c[tipo][status];
    return `${n} ${n === 1 ? tipo : TIPO_DISPOSITIVO_PLURAL[tipo]}`;
  });
  return partes.join(" · ") || "Nenhum";
}

const somaStatus = (c: Contagem, status: StatusDispositivo) =>
  TIPOS.reduce((total, tipo) => total + c[tipo][status], 0);

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
    c[tipo].baixado > 0 ? `Sem contar ${c[tipo].baixado} baixado${c[tipo].baixado === 1 ? "" : "s"}` : "Em operação";

  return (
    <section aria-label="Indicadores" className={GRADE_INDICADORES}>
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
        rotulo="Monitores"
        valor={total("monitor")}
        icone={MonitorIcon}
        detalhe={baixados("monitor")}
        href="/dispositivos?tipo=monitor"
      />
      <StatTile
        rotulo="Em uso"
        valor={somaStatus(c, "em_uso")}
        icone={UserRoundCheckIcon}
        corIcone="text-brand-blue dark:text-primary"
        detalhe={porTipo(c, "em_uso")}
        href="/dispositivos?status=em_uso"
      />
      <StatTile
        rotulo="Disponíveis"
        valor={somaStatus(c, "disponivel")}
        icone={CircleCheckIcon}
        corIcone="text-brand-green"
        detalhe={porTipo(c, "disponivel")}
        href="/dispositivos?status=disponivel"
      />
      <StatTile
        rotulo="Em manutenção"
        valor={somaStatus(c, "manutencao")}
        icone={WrenchIcon}
        corIcone="text-amber-600 dark:text-amber-400"
        detalhe={porTipo(c, "manutencao")}
        href="/dispositivos?status=manutencao"
      />
    </section>
  );
}

// ===========================================================================
// Vida útil
// ===========================================================================

const GRADE_VIDA_UTIL = "grid content-start gap-4 sm:grid-cols-3 lg:grid-cols-1";

/** Situações com card no dashboard (baixados ficam fora dos alertas). */
const ALERTAS_VIDA_UTIL = [
  "vencido",
  "proximo",
  "sem_data",
] as const satisfies readonly SituacaoVidaUtil[];

async function IndicadoresVidaUtil() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const supabase = await createClient();
  const resultados = await Promise.all(
    ALERTAS_VIDA_UTIL.map((situacao) =>
      supabase
        .from("vw_dispositivos")
        .select("id", { count: "exact", head: true })
        .eq("situacao_vida_util", situacao),
    ),
  );

  const erro = resultados.find((r) => r.error)?.error;
  if (erro) {
    console.error("Erro ao contar a vida útil:", erro);
    return <p className="text-destructive">Não foi possível carregar a vida útil.</p>;
  }
  const [vencidos, proximos, semData] = resultados.map((r) => r.count ?? 0);

  return (
    <div className={GRADE_VIDA_UTIL}>
      <StatTile
        rotulo="Vida útil vencida"
        valor={vencidos}
        icone={CalendarX2Icon}
        corIcone={vencidos > 0 ? "text-destructive" : undefined}
        detalhe="Fim da vida útil já passou"
        href="/dispositivos?vida=vencido"
      />
      <StatTile
        rotulo="Próximos da troca"
        valor={proximos}
        icone={CalendarClockIcon}
        corIcone={proximos > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        detalhe="Vida útil termina em até 6 meses"
        href="/dispositivos?vida=proximo"
      />
      <StatTile
        rotulo="Sem data"
        valor={semData}
        icone={CalendarOffIcon}
        detalhe="Sem fim da vida útil cadastrado"
        href="/dispositivos?vida=sem_data"
      />
    </div>
  );
}

const LIMITE_PROXIMOS = 10;

/**
 * Os 10 dispositivos em operação cuja vida útil termina primeiro. Vencidos
 * ficam de fora (têm card próprio); baixados e sem data também.
 */
async function ProximosDaTroca() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vw_dispositivos")
    .select(
      "id, tipo, marca, modelo, serial_number, imei1, numero_patrimonio, fim_vida_util, situacao_vida_util, colaborador_nome",
    )
    .in("situacao_vida_util", ["proximo", "ok"])
    .order("fim_vida_util")
    .order("id")
    .limit(LIMITE_PROXIMOS);

  if (error) {
    console.error("Erro ao listar a vida útil:", error);
    return (
      <CardSimples titulo="Próximos da troca">
        <p className="text-destructive">Não foi possível carregar os dispositivos.</p>
      </CardSimples>
    );
  }

  const hoje = hojeEmPalmas();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HourglassIcon className="size-4 text-muted-foreground" aria-hidden />
          Próximos da troca
        </CardTitle>
        <CardDescription>
          {data.length === 0
            ? "Nenhum dispositivo em operação com fim da vida útil a vencer."
            : `Até ${LIMITE_PROXIMOS} dispositivos em operação, do fim da vida útil mais próximo ao mais distante. Os já vencidos estão no card ao lado.`}
        </CardDescription>
      </CardHeader>
      {data.length > 0 && (
        <CardContent>
          <ol className="divide-y">
            {data.map((d, i) => (
              <li
                key={d.id ?? i}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link href={`/dispositivos/${d.id}`} className="font-medium hover:underline">
                    {d.marca} {d.modelo}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {identificadorDispositivo(d)}
                  </span>
                  <p className="text-muted-foreground">{d.colaborador_nome ?? "Sem usuário"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {d.fim_vida_util && (
                    <span className="text-right">
                      {formatarDataISO(d.fim_vida_util)}
                      <span className="block text-xs text-muted-foreground">
                        {formatarPrazo(d.fim_vida_util, hoje)}
                      </span>
                    </span>
                  )}
                  <VidaUtilBadge situacao={d.situacao_vida_util} />
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

// ===========================================================================
// Ativos por filial
// ===========================================================================

const GRADE_GRAFICOS = "grid gap-4 xl:grid-cols-3";

/**
 * Rótulo do eixo X: só a cidade ("Palmas", "Gurupi"). Sem cidade cadastrada,
 * o nome sem "Matriz"/"Filial". O tooltip e a tabela usam o nome completo.
 */
const rotuloFilial = (nome: string, cidade: string | null | undefined) =>
  cidade?.trim() || nome.replace(/^(matriz|filial)\s+/i, "");

/**
 * Contagem da vw_ativos_por_filial (migration 014): uma linha por tipo ×
 * loja, mais uma por tipo com loja nula (aparelhos sem filial).
 */
async function AtivosPorFilial() {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  const supabase = await createClient();
  const [{ data, error }, lojas] = await Promise.all([
    supabase.from("vw_ativos_por_filial").select("*"),
    listarLojasOpcoes(),
  ]);
  const cidades = new Map(lojas.map((l) => [l.id, l.cidade]));

  if (error) {
    console.error("Erro ao carregar ativos por filial:", error);
    return <p className="text-destructive">Não foi possível carregar os ativos por filial.</p>;
  }

  return (
    <div className={GRADE_GRAFICOS}>
      {TIPOS.map((tipo) => {
        const linhas = data.filter((l) => l.tipo === tipo);
        const barras: BarraFilial[] = linhas
          .flatMap((l) => {
            if (!l.loja_id || !l.loja_nome) return [];
            const em_uso = l.em_uso ?? 0;
            const em_estoque = l.em_estoque ?? 0;
            // Loja inativa só aparece se ainda tiver aparelhos.
            if (l.loja_ativa === false && em_uso + em_estoque === 0) return [];
            return [{
              lojaId: l.loja_id,
              loja: l.loja_nome,
              rotulo: rotuloFilial(l.loja_nome, cidades.get(l.loja_id)),
              em_uso,
              em_estoque,
              total: em_uso + em_estoque,
            }];
          })
          .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
        const semFilial = linhas
          .filter((l) => !l.loja_id)
          .reduce((soma, l) => soma + (l.em_uso ?? 0) + (l.em_estoque ?? 0), 0);
        return <GraficoAtivosFilial key={tipo} tipo={tipo} barras={barras} semFilial={semFilial} />;
      })}
    </div>
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
      "id, dispositivo_id, colaborador_id, data_inicio, loja:lojas(nome), colaborador:colaboradores(nome), dispositivo:dispositivos(tipo, marca, modelo, serial_number, imei1, numero_patrimonio)",
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
// Usuários com dados pendentes
// ===========================================================================

const LIMITE_PENDENTES = 10;

/** Usuários ativos sem CPF e/ou sem e-mail (opcionais desde a migration 013). */
async function UsuariosComDadosPendentes() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("colaboradores")
    .select("id, nome, cpf, email, loja:lojas(nome)", { count: "exact" })
    .eq("ativo", true)
    .or(FILTRO_DADOS_PENDENTES)
    .order("nome")
    .order("id")
    .limit(LIMITE_PENDENTES);

  if (error) {
    console.error("Erro ao listar usuários com dados pendentes:", error);
    return (
      <CardSimples titulo="Usuários com dados pendentes">
        <p className="text-destructive">Não foi possível carregar os usuários.</p>
      </CardSimples>
    );
  }

  const total = count ?? data.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRoundXIcon
            className={total > 0 ? "size-4 text-amber-600 dark:text-amber-400" : "size-4 text-muted-foreground"}
            aria-hidden
          />
          Usuários com dados pendentes
        </CardTitle>
        <CardDescription>
          {total === 0
            ? "Todos os usuários ativos têm CPF e e-mail cadastrados."
            : `${total} ${total === 1 ? "usuário ativo" : "usuários ativos"} sem CPF ou sem e-mail.`}
        </CardDescription>
      </CardHeader>
      {total > 0 && (
        <CardContent>
          <ul className="divide-y">
            {data.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link href={`/colaboradores/${c.id}`} className="font-medium hover:underline">
                    {c.nome}
                  </Link>
                  <p className="text-muted-foreground">{c.loja?.nome ?? "—"}</p>
                </div>
                <span className="text-xs font-medium text-amber-800 dark:text-amber-400">
                  {descreverPendencias(c)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            {total > data.length && `Mostrando ${data.length} de ${total}. `}
            <Link href="/colaboradores?pendentes=1" className="font-medium text-primary hover:underline">
              Ver na listagem de usuários
            </Link>
          </p>
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
