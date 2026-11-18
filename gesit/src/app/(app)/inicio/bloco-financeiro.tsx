import { CalendarClockIcon, CalendarX2Icon } from "lucide-react";
import { connection } from "next/server";

import { SituacaoVencimentoBadge } from "@/components/financeiro/badges";
import { hrefLancamento, nomeFinanceiro } from "@/lib/financeiro";
import { SELECT_LISTA } from "@/lib/financeiro-servidor";
import { formatarDataISO, formatarMoeda } from "@/lib/format";
import { buscarTodas } from "@/lib/relatorios/comum";
import { createClient } from "@/lib/supabase/server";

import { Bloco, ErroBloco, ItemBloco, ListaBloco, TudoEmDia, falhaDoBloco } from "./bloco";

/** Itens listados em cada bloco (o total em R$ soma todos). */
const LIMITE = 6;
/** "Próximas do vencimento": hoje e os próximos 7 dias. */
const DIAS_PROXIMOS = 7;
/** Em aberto e ainda não vencidas (regra da vw_lancamentos, migration 016). */
const A_VENCER = ["hoje", "proximo", "a_vencer"];

type Linha = {
  id: string | null;
  competencia: string | null;
  fornecedor: string | null;
  descricao: string | null;
  servico_identificador: string | null;
  loja_nome: string | null;
  vencimento: string | null;
  valor: number | null;
  situacao_vencimento: string | null;
  dias_para_vencer: number | null;
};

const somar = (linhas: { valor: number | null }[]) =>
  Math.round(linhas.reduce((s, l) => s + (l.valor ?? 0), 0) * 100) / 100;

function ItemLancamento({ l, detalhe }: { l: Linha; detalhe: string }) {
  if (!l.id || !l.competencia) return null;
  return (
    <ItemBloco href={hrefLancamento(l.id, l.competencia)} ancora>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {nomeFinanceiro({
            fornecedor: l.fornecedor ?? "—",
            descricao: l.descricao,
            identificador: l.servico_identificador,
          })}
        </span>
        <span className="block text-xs text-muted-foreground">
          {l.vencimento ? formatarDataISO(l.vencimento) : "—"} · {detalhe}
          {l.loja_nome && ` · ${l.loja_nome}`}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-medium tabular-nums">
          {l.valor === null ? "—" : formatarMoeda(l.valor)}
        </span>
        <SituacaoVencimentoBadge situacao={l.situacao_vencimento} dias={l.dias_para_vencer} />
      </span>
    </ItemBloco>
  );
}

// ===========================================================================
// Contas vencidas
// ===========================================================================

/** Vencidas e não pagas (de qualquer mês): as mais antigas e o total de todas. */
async function carregarVencidas() {
  const supabase = await createClient();
  const [lista, todas] = await Promise.all([
    supabase
      .from("vw_lancamentos")
      .select(SELECT_LISTA, { count: "exact" })
      .eq("situacao_vencimento", "vencido")
      .order("vencimento")
      .order("fornecedor")
      .order("id")
      .limit(LIMITE),
    buscarTodas((de, ate) =>
      supabase
        .from("vw_lancamentos")
        .select("id, valor")
        .eq("situacao_vencimento", "vencido")
        .order("id")
        .range(de, ate),
    ),
  ]);
  if (lista.error) throw lista.error;
  return { linhas: lista.data, qtd: lista.count ?? todas.length, total: somar(todas) };
}

export async function ContasVencidas() {
  await connection(); // sessão (o Supabase lê Date.now()) e "hoje" de Palmas: só na requisição
  const titulo = "Contas Vencidas";
  const dados = await carregarVencidas().catch(falhaDoBloco(titulo));
  if (!dados) return <ErroBloco titulo={titulo} icone={CalendarX2Icon} />;
  const { linhas, qtd, total } = dados;

  return (
    <Bloco
      titulo={titulo}
      icone={CalendarX2Icon}
      corIcone={qtd > 0 ? "text-destructive" : undefined}
      descricao={
        qtd > 0
          ? `${qtd} ${qtd === 1 ? "conta vencida" : "contas vencidas"} em aberto, de qualquer mês.`
          : "Vencimento passado e ainda não pagas."
      }
      acao={{ href: "/financeiro", rotulo: "Ver painel" }}
    >
      {qtd === 0 ? (
        <TudoEmDia>Nenhuma conta vencida em aberto.</TudoEmDia>
      ) : (
        <div className="grid gap-3">
          <p className="flex items-baseline justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2">
            <span className="text-sm text-destructive">Total vencido</span>
            <span className="text-xl font-semibold text-destructive tabular-nums">
              {formatarMoeda(total)}
            </span>
          </p>
          <ListaBloco>
            {linhas.map((l, i) => {
              const dias = l.dias_para_vencer === null ? null : Math.abs(l.dias_para_vencer);
              return (
                <ItemLancamento
                  key={l.id ?? i}
                  l={l}
                  detalhe={dias === null ? "Vencida" : `Há ${dias} ${dias === 1 ? "dia" : "dias"}`}
                />
              );
            })}
          </ListaBloco>
          {qtd > linhas.length && (
            <p className="text-xs text-muted-foreground">
              Mostrando as {linhas.length} mais antigas de {qtd}.
            </p>
          )}
        </div>
      )}
    </Bloco>
  );
}

// ===========================================================================
// Próximas do vencimento
// ===========================================================================

/** Em aberto, vencendo hoje ou nos próximos 7 dias. */
async function carregarProximas() {
  const supabase = await createClient();
  const [lista, todas] = await Promise.all([
    supabase
      .from("vw_lancamentos")
      .select(SELECT_LISTA, { count: "exact" })
      .in("situacao_vencimento", A_VENCER)
      .lte("dias_para_vencer", DIAS_PROXIMOS)
      .order("vencimento")
      .order("fornecedor")
      .order("id")
      .limit(LIMITE),
    buscarTodas((de, ate) =>
      supabase
        .from("vw_lancamentos")
        .select("id, valor, situacao_vencimento")
        .in("situacao_vencimento", A_VENCER)
        .lte("dias_para_vencer", DIAS_PROXIMOS)
        .order("id")
        .range(de, ate),
    ),
  ]);
  if (lista.error) throw lista.error;
  return {
    linhas: lista.data,
    qtd: lista.count ?? todas.length,
    total: somar(todas),
    hoje: todas.filter((l) => l.situacao_vencimento === "hoje").length,
  };
}

export async function ProximasDoVencimento() {
  await connection(); // sessão (o Supabase lê Date.now()) e "hoje" de Palmas: só na requisição
  const titulo = "Próximas do Vencimento";
  const dados = await carregarProximas().catch(falhaDoBloco(titulo));
  if (!dados) return <ErroBloco titulo={titulo} icone={CalendarClockIcon} />;
  const { linhas, qtd, total, hoje } = dados;

  return (
    <Bloco
      titulo={titulo}
      icone={CalendarClockIcon}
      corIcone={hoje > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
      descricao={
        qtd > 0
          ? `${qtd} em aberto até ${DIAS_PROXIMOS} dias${
              hoje > 0 ? `, ${hoje} ${hoje === 1 ? "vence" : "vencem"} hoje` : ""
            }. Total ${formatarMoeda(total)}.`
          : `Hoje e os próximos ${DIAS_PROXIMOS} dias.`
      }
      acao={{ href: "/financeiro", rotulo: "Ver painel" }}
    >
      {qtd === 0 ? (
        <TudoEmDia>Nada vence nos próximos {DIAS_PROXIMOS} dias.</TudoEmDia>
      ) : (
        <div className="grid gap-3">
          <ListaBloco>
            {linhas.map((l, i) => (
              <ItemLancamento
                key={l.id ?? i}
                l={l}
                detalhe={l.situacao_vencimento === "hoje" ? "Vence hoje" : "Em aberto"}
              />
            ))}
          </ListaBloco>
          {qtd > linhas.length && (
            <p className="text-xs text-muted-foreground">
              Mostrando as {linhas.length} mais próximas de {qtd}.
            </p>
          )}
        </div>
      )}
    </Bloco>
  );
}
