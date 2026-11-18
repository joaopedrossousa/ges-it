import { cn } from "cn";
import {
  AlarmClockIcon,
  ArrowRightLeftIcon,
  CalendarIcon,
  HistoryIcon,
  MessageCircleIcon,
  PlusIcon,
  SirenIcon,
  SquareUserRoundIcon,
} from "lucide-react";
import { connection } from "next/server";

import { Etiqueta, SeloPrioridade } from "@/components/atividades/etiquetas";
import { CLASSES_COR, nomeUsuario, situacaoPrazo, type CategoriaKanban } from "@/lib/atividades";
import {
  listarCategoriasKanban,
  listarColunasAtivas,
  listarUsuariosSistema,
  usuarioLogadoId,
} from "@/lib/atividades-servidor";
import type { Json } from "@/lib/database.types";
import { formatarDataHora, formatarDataISO, hojeEmPalmas } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { CorKanban, PrioridadeAtividade } from "@/lib/types";

import { Bloco, ErroBloco, ItemBloco, ListaBloco, TudoEmDia, falhaDoBloco } from "./bloco";

const hrefAtividade = (id: string) => `/atividades?atividade=${id}`;

/** Alta → média → baixa. */
const PESO_PRIORIDADE: Record<PrioridadeAtividade, number> = { alta: 0, media: 1, baixa: 2 };

/** Prazo: vencido em vermelho, hoje em amarelo, futuro em texto simples. */
function Prazo({ prazo, hoje }: { prazo: string | null; hoje: string }) {
  if (!prazo) return null;
  const s = situacaoPrazo(prazo, hoje);
  if (s === "vencido") {
    return (
      <Etiqueta cor="vermelho">
        <AlarmClockIcon aria-hidden className="size-3" />
        Vencido em {formatarDataISO(prazo)}
      </Etiqueta>
    );
  }
  if (s === "hoje") {
    return (
      <Etiqueta cor="amarelo">
        <AlarmClockIcon aria-hidden className="size-3" />
        Vence hoje
      </Etiqueta>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <CalendarIcon aria-hidden className="size-3" />
      <span className="sr-only">Prazo: </span>
      {formatarDataISO(prazo)}
    </span>
  );
}

function SeloUrgente() {
  return (
    <Etiqueta cor="vermelho">
      <SirenIcon aria-hidden className="size-3" />
      Urgente
    </Etiqueta>
  );
}

function Comentarios({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span
      className="flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums"
      title={`${n} ${n === 1 ? "comentário" : "comentários"}`}
    >
      <MessageCircleIcon aria-hidden className="size-3.5" />
      {n}
      <span className="sr-only">{n === 1 ? " comentário" : " comentários"}</span>
    </span>
  );
}

function SeloColuna({ nome, cor }: { nome: string; cor: CorKanban }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", CLASSES_COR[cor].etiqueta)}>
      {nome}
    </span>
  );
}

// ===========================================================================
// Meus cards
// ===========================================================================

const LIMITE_MEUS = 20;

/** Atividades do usuário logado, com categorias, em grupos na ordem das colunas. */
async function carregarMeusCards() {
  const supabase = await createClient();
  const [uid, minhas, colunas, categorias] = await Promise.all([
    usuarioLogadoId(),
    supabase.from("vw_minhas_atividades").select("*"),
    listarColunasAtivas(),
    listarCategoriasKanban(),
  ]);
  if (minhas.error) throw minhas.error;

  const ids = minhas.data.flatMap((a) => (a.id ? [a.id] : []));
  const cats =
    ids.length > 0
      ? await supabase
          .from("kanban_atividade_categorias")
          .select("atividade_id, categoria_id")
          .in("atividade_id", ids)
      : { data: [], error: null };
  if (cats.error) throw cats.error;

  const categoriasPorId = new Map(categorias.map((c) => [c.id, c]));
  const categoriasDe = new Map<string, CategoriaKanban[]>();
  for (const { atividade_id, categoria_id } of cats.data) {
    const c = categoriasPorId.get(categoria_id);
    if (c) categoriasDe.set(atividade_id, [...(categoriasDe.get(atividade_id) ?? []), c]);
  }

  const hoje = hojeEmPalmas();
  // Urgentes primeiro; depois prazo (sem prazo por último), prioridade e título.
  const ordenadas = [...minhas.data].sort(
    (a, b) =>
      Number(b.urgente) - Number(a.urgente) ||
      (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") ||
      (a.prioridade && b.prioridade
        ? PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]
        : 0) ||
      (a.titulo ?? "").localeCompare(b.titulo ?? "", "pt-BR"),
  );
  const visiveis = ordenadas.slice(0, LIMITE_MEUS);
  const grupos = colunas
    .map((c) => ({ coluna: c, itens: visiveis.filter((a) => a.coluna_id === c.id) }))
    .filter((g) => g.itens.length > 0);

  return {
    uid,
    hoje,
    grupos,
    categoriasDe,
    total: minhas.data.length,
    mostrados: visiveis.length,
    vencidos: minhas.data.filter((a) => a.prazo && a.prazo < hoje).length,
  };
}

export async function MeusCards() {
  await connection(); // sessão (o Supabase lê Date.now()) e "hoje" de Palmas: só na requisição
  const titulo = "Meus Cards";
  const dados = await carregarMeusCards().catch(falhaDoBloco(titulo));
  if (!dados) return <ErroBloco titulo={titulo} icone={SquareUserRoundIcon} />;
  const { uid, hoje, grupos, categoriasDe, total, mostrados, vencidos } = dados;

  return (
    <Bloco
      titulo={titulo}
      icone={SquareUserRoundIcon}
      descricao={
        total > 0
          ? `${total} ${total === 1 ? "atividade atribuída" : "atividades atribuídas"} a você${
              vencidos > 0 ? `, ${vencidos} com prazo vencido` : ""
            }.`
          : "Atividades do quadro em que você é o responsável."
      }
      acao={uid ? { href: `/atividades?responsavel=${uid}`, rotulo: "Ver no quadro" } : undefined}
    >
      {total === 0 ? (
        <TudoEmDia>Nenhuma atividade atribuída a você.</TudoEmDia>
      ) : (
        <div className="grid gap-4">
          {grupos.map(({ coluna, itens }) => (
            <section key={coluna.id} aria-label={`Coluna ${coluna.nome}`} className="grid gap-1">
              <h3 className="flex items-center gap-2">
                <SeloColuna nome={coluna.nome} cor={coluna.cor} />
                <span className="text-xs text-muted-foreground">{itens.length}</span>
              </h3>
              <ListaBloco>
                {itens.map((a) =>
                  a.id ? (
                    <ItemBloco key={a.id} href={hrefAtividade(a.id)}>
                      <span className="grid min-w-0 flex-1 gap-1.5">
                        <span className="font-medium break-words">{a.titulo}</span>
                        <span className="flex flex-wrap items-center gap-1">
                          {a.urgente && <SeloUrgente />}
                          {a.prioridade && <SeloPrioridade prioridade={a.prioridade} />}
                          {(categoriasDe.get(a.id) ?? []).map((c) => (
                            <Etiqueta key={c.id} cor={c.cor}>
                              {c.nome}
                            </Etiqueta>
                          ))}
                          <Prazo prazo={a.prazo} hoje={hoje} />
                          <Comentarios n={a.comentarios} />
                        </span>
                      </span>
                    </ItemBloco>
                  ) : null,
                )}
              </ListaBloco>
            </section>
          ))}
          {total > mostrados && (
            <p className="text-xs text-muted-foreground">
              Mostrando {mostrados} de {total}. As demais estão no quadro.
            </p>
          )}
        </div>
      )}
    </Bloco>
  );
}

// ===========================================================================
// Urgentes
// ===========================================================================

const LIMITE_URGENTES = 8;

/** Cards urgentes de todos, dos marcados mais recentemente. */
async function carregarUrgentes() {
  const supabase = await createClient();
  const [urgentes, usuarios] = await Promise.all([
    supabase
      .from("vw_atividades_urgentes")
      .select(
        "id, titulo, prioridade, prazo, urgente_em, responsavel_id, coluna_nome, coluna_cor, comentarios",
        { count: "exact" },
      )
      .order("urgente_em", { ascending: false })
      .order("id")
      .limit(LIMITE_URGENTES),
    listarUsuariosSistema(),
  ]);
  if (urgentes.error) throw urgentes.error;
  return {
    linhas: urgentes.data,
    total: urgentes.count ?? urgentes.data.length,
    usuariosPorId: new Map(usuarios.map((u) => [u.id, u])),
    hoje: hojeEmPalmas(),
  };
}

export async function Urgentes() {
  await connection(); // sessão (o Supabase lê Date.now()) e "hoje" de Palmas: só na requisição
  const titulo = "Urgentes";
  const dados = await carregarUrgentes().catch(falhaDoBloco(titulo));
  if (!dados) return <ErroBloco titulo={titulo} icone={SirenIcon} />;
  const { linhas, total, usuariosPorId, hoje } = dados;

  return (
    <Bloco
      titulo={titulo}
      icone={SirenIcon}
      // Destaque só com itens: vazio, o bloco fica neutro ("Tudo em dia").
      destaque={total > 0}
      descricao={
        total > 0
          ? `${total} ${total === 1 ? "atividade urgente" : "atividades urgentes"} no quadro.`
          : "Atividades marcadas como urgentes, de todos."
      }
      acao={{ href: "/atividades?urgente=1", rotulo: "Ver no quadro" }}
    >
      {total === 0 ? (
        <TudoEmDia>Nenhuma atividade urgente.</TudoEmDia>
      ) : (
        <div className="grid gap-3">
          <ListaBloco grade>
            {linhas.map((a) =>
              a.id ? (
                <ItemBloco key={a.id} href={hrefAtividade(a.id)}>
                  <span className="grid min-w-0 flex-1 gap-1.5">
                    <span className="font-medium break-words">{a.titulo}</span>
                    <span className="flex flex-wrap items-center gap-1">
                      {a.coluna_nome && a.coluna_cor && (
                        <SeloColuna nome={a.coluna_nome} cor={a.coluna_cor} />
                      )}
                      {a.prioridade && <SeloPrioridade prioridade={a.prioridade} />}
                      <Prazo prazo={a.prazo} hoje={hoje} />
                      <Comentarios n={a.comentarios} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.responsavel_id
                        ? nomeUsuario(usuariosPorId.get(a.responsavel_id))
                        : "Sem responsável"}
                      {a.urgente_em && ` · urgente desde ${formatarDataHora(a.urgente_em)}`}
                    </span>
                  </span>
                </ItemBloco>
              ) : null,
            )}
          </ListaBloco>
          {total > linhas.length && (
            <p className="text-xs text-muted-foreground">
              Mostrando as {linhas.length} marcadas mais recentemente de {total}.
            </p>
          )}
        </div>
      )}
    </Bloco>
  );
}

// ===========================================================================
// Atividades recentes (log de auditoria)
// ===========================================================================

const LIMITE_RECENTES = 10;

const objeto = (j: Json | null): Record<string, Json | undefined> =>
  j && typeof j === "object" && !Array.isArray(j) ? j : {};
const texto = (v: Json | undefined) => (typeof v === "string" ? v : null);

/** "Texto longo do comentário…" */
const trecho = (s: string, max = 90) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

type Evento = {
  id: number;
  tipo: "criou" | "moveu" | "comentou";
  quando: string;
  autorId: string | null;
  atividadeId: string | null;
  colunaDe: string | null;
  colunaPara: string | null;
  comentario: string | null;
};

const ICONE_EVENTO = { criou: PlusIcon, moveu: ArrowRightLeftIcon, comentou: MessageCircleIcon };

/**
 * Últimas criações, movimentações (troca de coluna) e comentários do quadro,
 * lidos do log de auditoria (a ordem dentro da coluna não entra no log).
 */
async function carregarRecentes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auditoria")
    .select("id, tabela, registro_id, acao, alterado_por, alterado_em, antes, depois")
    .in("tabela", ["kanban_atividades", "kanban_comentarios"])
    .or(
      "and(tabela.eq.kanban_atividades,acao.eq.insercao)," +
        "and(tabela.eq.kanban_atividades,campos_alterados.cs.{coluna_id})," +
        "and(tabela.eq.kanban_comentarios,acao.eq.insercao)",
    )
    .order("alterado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMITE_RECENTES);
  if (error) throw error;

  const eventos: Evento[] = data.map((l) => {
    const antes = objeto(l.antes);
    const depois = objeto(l.depois);
    const comentario = l.tabela === "kanban_comentarios";
    return {
      id: l.id,
      tipo: comentario ? "comentou" : l.acao === "insercao" ? "criou" : "moveu",
      quando: l.alterado_em,
      autorId: l.alterado_por,
      atividadeId: comentario ? texto(depois.atividade_id) : l.registro_id,
      colunaDe: texto(antes.coluna_id),
      colunaPara: texto(depois.coluna_id),
      comentario: comentario ? texto(depois.texto) : null,
    };
  });

  const idsAtividades = [...new Set(eventos.flatMap((e) => (e.atividadeId ? [e.atividadeId] : [])))];
  const [atividades, colunas, usuarios] = await Promise.all([
    idsAtividades.length > 0
      ? supabase.from("kanban_atividades").select("id, titulo, arquivada").in("id", idsAtividades)
      : Promise.resolve({ data: [], error: null }),
    // Inclui as arquivadas: o log pode citar uma coluna que já saiu do quadro.
    supabase.from("kanban_colunas").select("id, nome"),
    listarUsuariosSistema(),
  ]);
  if (atividades.error) throw atividades.error;
  if (colunas.error) throw colunas.error;

  return {
    eventos,
    atividadesPorId: new Map(atividades.data.map((a) => [a.id, a])),
    colunasPorId: new Map(colunas.data.map((c) => [c.id, c.nome])),
    usuariosPorId: new Map(usuarios.map((u) => [u.id, u])),
  };
}

export async function AtividadesRecentes() {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  const titulo = "Atividades Recentes";
  const dados = await carregarRecentes().catch(falhaDoBloco(titulo));
  if (!dados) return <ErroBloco titulo={titulo} icone={HistoryIcon} />;
  const { eventos, atividadesPorId, colunasPorId, usuariosPorId } = dados;
  const nomeColuna = (id: string | null) => (id && colunasPorId.get(id)) || "coluna removida";

  return (
    <Bloco
      titulo={titulo}
      icone={HistoryIcon}
      descricao="Criações, movimentações e comentários mais recentes do quadro."
      acao={{ href: "/atividades", rotulo: "Ver quadro" }}
    >
      {eventos.length === 0 ? (
        <TudoEmDia>Nenhuma movimentação no quadro ainda.</TudoEmDia>
      ) : (
        <ListaBloco>
          {eventos.map((e) => {
            const a = e.atividadeId ? atividadesPorId.get(e.atividadeId) : undefined;
            const quem = e.autorId ? nomeUsuario(usuariosPorId.get(e.autorId)) : "Sistema";
            const Icone = ICONE_EVENTO[e.tipo];
            const href = !a
              ? "/atividades"
              : a.arquivada
                ? "/atividades/arquivadas"
                : hrefAtividade(a.id);
            const nomeAtividade = <span className="font-medium">{a?.titulo ?? "uma atividade"}</span>;
            return (
              <ItemBloco key={e.id} href={href}>
                <Icone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block break-words">
                    <span className="font-medium">{quem}</span>{" "}
                    {e.tipo === "criou" && (
                      <>
                        criou {nomeAtividade} em {nomeColuna(e.colunaPara)}
                      </>
                    )}
                    {e.tipo === "moveu" && (
                      <>
                        moveu {nomeAtividade} de {nomeColuna(e.colunaDe)} para{" "}
                        {nomeColuna(e.colunaPara)}
                      </>
                    )}
                    {e.tipo === "comentou" && <>comentou em {nomeAtividade}</>}
                    {a?.arquivada && <span className="text-muted-foreground"> (arquivada)</span>}
                  </span>
                  {e.comentario && (
                    <span className="block truncate text-muted-foreground">
                      &ldquo;{trecho(e.comentario)}&rdquo;
                    </span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {formatarDataHora(e.quando)}
                  </span>
                </span>
              </ItemBloco>
            );
          })}
        </ListaBloco>
      )}
    </Bloco>
  );
}
