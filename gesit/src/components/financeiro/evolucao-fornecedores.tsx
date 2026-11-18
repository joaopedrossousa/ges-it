"use client";

import { cn } from "cn";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ExportarMenu } from "@/components/exportar";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { formatarMes, mesCurto } from "@/lib/financeiro";
import {
  AGRUPAMENTOS_EVOLUCAO,
  PERIODOS_EVOLUCAO,
  hrefLancamentosDaSerie,
  mesesDoPeriodo,
  tabelaEvolucao,
  textoVariacao,
  type AgrupamentoEvolucao,
  type DadosEvolucao,
  type PeriodoEvolucao,
  type SerieEvolucao,
} from "@/lib/financeiro-evolucao";
import { formatarMoeda } from "@/lib/format";

// ---------------------------------------------------------------------------
// Cores e traços: seguem a série (posição pelo total de todo o histórico),
// nunca a seleção. 8 cores validadas (tokens --serie-*, claro e escuro) x 3
// traços; da 25ª posição em diante, cinza pontilhado.
// ---------------------------------------------------------------------------

const CORES = Array.from({ length: 8 }, (_, i) => `var(--serie-${i + 1})`);
const TRACOS = [undefined, "6 4", "1.5 3"] as const;
const COR_RESTO = "var(--muted-foreground)";

/** No gráfico, ao mesmo tempo (a tabela mostra todas). */
const MAX_SERIES = 16;
/** Padrão: as maiores do período. */
const PADRAO = 6;
/** Até quantas séries visíveis recebem o nome na ponta da linha. */
const MAX_ROTULOS_DIRETOS = 4;

function estilo(s: SerieEvolucao) {
  if (s.ordem >= CORES.length * TRACOS.length) return { cor: COR_RESTO, traco: "1.5 3" };
  return { cor: CORES[s.ordem % CORES.length], traco: TRACOS[Math.floor(s.ordem / CORES.length)] };
}

const compacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const moedaCurta = (v: number) => compacto.format(v);

/** Escala "logarítmica" que aceita zero (symlog): y = log10(1 + v). */
const paraLog = (v: number) => Math.log10(1 + Math.max(0, v));
const deLog = (y: number) => Math.max(0, 10 ** y - 1);

const normalizar = (t: string) =>
  t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

const encurtar = (t: string, max = 22) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

function AmostraLinha({ s }: { s: SerieEvolucao }) {
  const { cor, traco } = estilo(s);
  return (
    <svg aria-hidden width="18" height="8" className="shrink-0">
      <line x1="1" y1="4" x2="17" y2="4" stroke={cor} strokeWidth="2.5" strokeDasharray={traco} strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  dados: DadosEvolucao;
  /** Mês do Painel ("AAAA-MM"): o período termina nele. */
  mesRef: string;
};

/**
 * Evolução Mensal por Fornecedor (ou por serviço): linhas por série com as
 * maiores do período por padrão, seletor com busca, legenda que oculta e
 * mostra, escala log opcional e a tabela com total, média e variação.
 */
export function EvolucaoFornecedores({ dados, mesRef }: Props) {
  const [periodo, setPeriodo] = useState<PeriodoEvolucao>("12m");
  const [agrupamento, setAgrupamento] = useState<AgrupamentoEvolucao>("fornecedor");
  // null = padrão (as 6 maiores do período); trocar de agrupamento volta ao padrão.
  const [escolhidas, setEscolhidas] = useState<{ agrupamento: AgrupamentoEvolucao; chaves: string[] } | null>(null);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [log, setLog] = useState(false);

  const meses = useMemo(() => mesesDoPeriodo(periodo, mesRef, dados), [periodo, mesRef, dados]);
  const tabela = useMemo(() => tabelaEvolucao(dados[agrupamento], meses), [dados, agrupamento, meses]);

  const selecionadas =
    escolhidas && escolhidas.agrupamento === agrupamento
      ? escolhidas.chaves.filter((c) => tabela.linhas.some((l) => l.serie.chave === c))
      : tabela.linhas.slice(0, PADRAO).map((l) => l.serie.chave);
  const selecionadasSet = new Set(selecionadas);
  const noGrafico = tabela.linhas.filter((l) => selecionadasSet.has(l.serie.chave));
  const visiveis = noGrafico.filter((l) => !ocultas.has(l.serie.chave));

  function definirSelecao(chaves: string[]) {
    setEscolhidas({ agrupamento, chaves: chaves.slice(0, MAX_SERIES) });
  }
  function alternarSelecao(chave: string) {
    if (selecionadasSet.has(chave)) definirSelecao(selecionadas.filter((c) => c !== chave));
    else if (selecionadas.length < MAX_SERIES) {
      definirSelecao([...selecionadas, chave]);
      setOcultas((o) => {
        const n = new Set(o);
        n.delete(chave);
        return n;
      });
    }
  }
  function alternarOculta(chave: string) {
    setOcultas((o) => {
      const n = new Set(o);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });
  }

  // Dados do gráfico: uma linha por mês; s<i> = valor, l<i> = valor na escala log.
  const pontos = meses.map((mes, i) => {
    const p: Record<string, string | number> = {
      mes,
      rotulo: mesCurto(mes),
      nome: formatarMes(mes),
      total: tabela.totais[i],
    };
    noGrafico.forEach((l, j) => {
      p[`s${j}`] = l.valores[i];
      p[`l${j}`] = paraLog(l.valores[i]);
    });
    return p;
  });
  const maximo = Math.max(0, ...visiveis.flatMap((l) => l.valores));
  // Escala log: marcas nas potências de 10 até a primeira acima do máximo.
  const DECADAS = [0, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000];
  const tetoLog = DECADAS.find((v) => v >= maximo) ?? DECADAS[DECADAS.length - 1];
  const ticksLog = DECADAS.filter((v) => v <= tetoLog).map(paraLog);
  const config = Object.fromEntries(
    noGrafico.map((l, j) => [`s${j}`, { label: l.serie.nome, color: estilo(l.serie).cor }]),
  ) satisfies ChartConfig;
  const rotulosDiretos = visiveis.length <= MAX_ROTULOS_DIRETOS;
  const vazio = tabela.linhas.length === 0;
  const nomeAgrupamento = agrupamento === "fornecedor" ? "fornecedor" : "serviço";

  return (
    <section
      aria-labelledby="evolucao-fornecedor-titulo"
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 id="evolucao-fornecedor-titulo" className="font-semibold">
            Evolução Mensal por Fornecedor
          </h2>
          <p className="text-sm text-muted-foreground">
            Mesma regra da Evolução Mensal (cancelados fora). {formatarMoeda(tabela.totalGeral)} no
            período, de {meses.length > 0 ? `${mesCurto(meses[0])} a ${mesCurto(meses[meses.length - 1])}` : "—"}.
          </p>
        </div>
        <ExportarMenu
          relatorio="financeiro-evolucao-fornecedor"
          params={{ mes: mesRef, periodo, agrupamento }}
          size="sm"
        />
      </div>

      {/* Filtros numa linha, acima do gráfico. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Alternancia
          rotulo="Período"
          opcoes={PERIODOS_EVOLUCAO}
          valor={periodo}
          onChange={setPeriodo}
        />
        <Alternancia
          rotulo="Agrupamento"
          opcoes={AGRUPAMENTOS_EVOLUCAO}
          valor={agrupamento}
          onChange={(v) => {
            setAgrupamento(v);
            setOcultas(new Set());
          }}
        />
        <SeletorSeries
          linhas={tabela.linhas}
          selecionadas={selecionadasSet}
          onAlternar={alternarSelecao}
          onDefinir={definirSelecao}
          nomeAgrupamento={nomeAgrupamento}
        />
        <div className="flex items-center gap-2">
          <Switch id="evolucao-log" checked={log} onCheckedChange={setLog} />
          <Label htmlFor="evolucao-log" className="font-normal">
            Escala logarítmica
          </Label>
        </div>
      </div>

      {vazio ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento no período.
        </p>
      ) : (
        <>
          <div className="relative">
            <ChartContainer
              config={config}
              className="aspect-auto h-80 w-full"
              role="img"
              aria-label={`Evolução mensal de ${visiveis.length} ${visiveis.length === 1 ? nomeAgrupamento : `${nomeAgrupamento}s`}: ${visiveis
                .map((l) => `${l.serie.nome}, ${formatarMoeda(l.total)} no período`)
                .join("; ")}. Valores mês a mês na tabela abaixo.`}
            >
              <LineChart
                data={pontos}
                margin={{ top: 12, right: rotulosDiretos ? 132 : 16, left: 4, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={76}
                  ticks={log ? ticksLog : undefined}
                  domain={log ? [0, Math.max(paraLog(tetoLog), 1)] : [0, "auto"]}
                  tickFormatter={(v: number) => moedaCurta(log ? Math.round(deLog(v)) : v)}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as Record<string, number | string> | undefined;
                    if (!active || !p) return null;
                    const itens = visiveis
                      .map((l) => ({ l, valor: Number(p[`s${noGrafico.indexOf(l)}`] ?? 0) }))
                      .sort((a, b) => b.valor - a.valor);
                    return (
                      <div className="grid min-w-56 gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                        <p className="font-medium">{String(p.nome)}</p>
                        {itens.map(({ l, valor }) => (
                          <p key={l.serie.chave} className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                              <AmostraLinha s={l.serie} />
                              <span className="truncate">{l.serie.nome}</span>
                            </span>
                            <span className="font-mono font-medium tabular-nums">{formatarMoeda(valor)}</span>
                          </p>
                        ))}
                        <p className="flex justify-between gap-3 border-t pt-1">
                          <span className="text-muted-foreground">Total do mês (todos)</span>
                          <span className="font-mono font-medium tabular-nums">
                            {formatarMoeda(Number(p.total))}
                          </span>
                        </p>
                      </div>
                    );
                  }}
                />
                {noGrafico.map((l, j) => {
                  if (ocultas.has(l.serie.chave)) return null;
                  const { cor, traco } = estilo(l.serie);
                  return (
                    <Line
                      key={l.serie.chave}
                      type="linear"
                      dataKey={log ? `l${j}` : `s${j}`}
                      name={l.serie.nome}
                      stroke={cor}
                      strokeWidth={2}
                      strokeDasharray={traco}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                      isAnimationActive={false}
                      label={
                        rotulosDiretos
                          ? (props: unknown) => {
                              // Nome na ponta da linha (último mês), em cor de texto.
                              const { x, y, index } = props as { x?: number | string; y?: number | string; index?: number };
                              return index === meses.length - 1 ? (
                                <text
                                  key={`rotulo-${l.serie.chave}`}
                                  x={Number(x ?? 0) + 8}
                                  y={Number(y ?? 0) + 4}
                                  className="fill-foreground text-xs"
                                >
                                  {encurtar(l.serie.nome, 18)}
                                </text>
                              ) : (
                                <g key={`v-${l.serie.chave}-${index}`} />
                              );
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </LineChart>
            </ChartContainer>
          </div>

          {/* Legenda (sempre presente): clicar oculta ou mostra a série. */}
          {noGrafico.length > 0 ? (
            <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Legenda (clique para ocultar ou mostrar)">
              {noGrafico.map((l) => {
                const oculta = ocultas.has(l.serie.chave);
                return (
                  <li key={l.serie.chave}>
                    <button
                      type="button"
                      aria-pressed={!oculta}
                      onClick={() => alternarOculta(l.serie.chave)}
                      className={cn(
                        "flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        oculta && "line-through opacity-50",
                      )}
                      title={oculta ? "Mostrar no gráfico" : "Ocultar do gráfico"}
                    >
                      <AmostraLinha s={l.serie} />
                      {l.serie.nome}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum {nomeAgrupamento} marcado. Escolha no seletor ou clique numa linha da tabela.
            </p>
          )}

          <TabelaEvolucao
            tabela={tabela}
            meses={meses}
            selecionadas={selecionadasSet}
            onAlternar={alternarSelecao}
            nomeAgrupamento={nomeAgrupamento}
            cheio={selecionadas.length >= MAX_SERIES}
          />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Alternancia<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string;
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex rounded-lg border p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "rounded-md px-2.5 py-1 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            o.valor === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

function SeletorSeries({
  linhas,
  selecionadas,
  onAlternar,
  onDefinir,
  nomeAgrupamento,
}: {
  linhas: ReturnType<typeof tabelaEvolucao>["linhas"];
  selecionadas: Set<string>;
  onAlternar: (chave: string) => void;
  onDefinir: (chaves: string[]) => void;
  nomeAgrupamento: string;
}) {
  const [busca, setBusca] = useState("");
  const termo = normalizar(busca);
  const filtradas = termo ? linhas.filter((l) => normalizar(l.serie.nome).includes(termo)) : linhas;
  const cheio = selecionadas.size >= MAX_SERIES;

  return (
    <Popover onOpenChange={(v) => !v && setBusca("")}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between gap-2">
          {selecionadas.size} de {linhas.length} no gráfico
          <ChevronsUpDownIcon className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar ${nomeAgrupamento}...`}
            aria-label={`Buscar ${nomeAgrupamento}`}
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex flex-wrap gap-1 border-b px-2 py-1.5">
          <Button variant="ghost" size="xs" onClick={() => onDefinir(linhas.slice(0, PADRAO).map((l) => l.serie.chave))}>
            Os {PADRAO} maiores
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onDefinir(linhas.map((l) => l.serie.chave))}>
            {linhas.length > MAX_SERIES ? `Os ${MAX_SERIES} maiores` : "Todos"}
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onDefinir([])}>
            Nenhum
          </Button>
        </div>
        <ul role="listbox" aria-multiselectable aria-label={`${nomeAgrupamento}s`} className="max-h-72 overflow-y-auto p-1">
          {filtradas.length === 0 && (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">Nenhum resultado.</li>
          )}
          {filtradas.map((l) => {
            const marcada = selecionadas.has(l.serie.chave);
            const bloqueada = !marcada && cheio;
            return (
              <li key={l.serie.chave}>
                <button
                  type="button"
                  role="option"
                  aria-selected={marcada}
                  disabled={bloqueada}
                  onClick={() => onAlternar(l.serie.chave)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      marcada ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {marcada && <CheckIcon className="size-3" />}
                  </span>
                  <AmostraLinha s={l.serie} />
                  <span className="min-w-0 flex-1 truncate">{l.serie.nome}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatarMoeda(l.total)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {cheio && (
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Até {MAX_SERIES} no gráfico ao mesmo tempo; todos continuam na tabela.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Variacao({ v }: { v: { variacao: number | null; novo: boolean } }) {
  const texto = textoVariacao(v);
  if (v.variacao === null || v.variacao === 0) {
    return <span className="text-muted-foreground">{texto}</span>;
  }
  // Despesa: subir é ruim (vermelho), cair é bom (verde). Seta + sinal: a cor nunca sozinha.
  const sobe = v.variacao > 0;
  const Icone = sobe ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className={cn("inline-flex items-center gap-0.5", sobe ? "text-destructive" : "text-brand-green-strong")}>
      <Icone className="size-3" aria-hidden />
      {texto}
      <span className="sr-only">{sobe ? " (aumento)" : " (queda)"}</span>
    </span>
  );
}

function TabelaEvolucao({
  tabela,
  meses,
  selecionadas,
  onAlternar,
  nomeAgrupamento,
  cheio,
}: {
  tabela: ReturnType<typeof tabelaEvolucao>;
  meses: string[];
  selecionadas: Set<string>;
  onAlternar: (chave: string) => void;
  nomeAgrupamento: string;
  cheio: boolean;
}) {
  const primeiraColuna = "sticky left-0 z-10 bg-card";
  return (
    <div className="min-w-0 space-y-1">
      <div className="relative overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <caption className="sr-only">
            Valores por {nomeAgrupamento} e mês, com total, média mensal e variação do último mês.
          </caption>
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className={cn(primeiraColuna, "px-2 py-1.5 text-left font-medium")}>
                {nomeAgrupamento === "fornecedor" ? "Fornecedor" : "Serviço"}
              </th>
              {meses.map((m) => (
                <th key={m} scope="col" className="px-2 py-1.5 text-right font-medium whitespace-nowrap">
                  {mesCurto(m)}
                </th>
              ))}
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Total</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Média Mensal</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">Variação</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {tabela.linhas.map((l) => {
              const marcada = selecionadas.has(l.serie.chave);
              return (
                <tr key={l.serie.chave} className="border-b last:border-b-0 hover:bg-muted/40">
                  <th scope="row" className={cn(primeiraColuna, "max-w-56 px-2 py-1 text-left font-normal")}>
                    <button
                      type="button"
                      onClick={() => onAlternar(l.serie.chave)}
                      disabled={!marcada && cheio}
                      aria-pressed={marcada}
                      title={marcada ? "Tirar do gráfico" : "Mostrar no gráfico"}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-1.5 rounded text-left hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                        marcada ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span aria-hidden className={cn(!marcada && "opacity-30")}>
                        <AmostraLinha s={l.serie} />
                      </span>
                      <span className="truncate">{l.serie.nome}</span>
                    </button>
                  </th>
                  {l.valores.map((v, i) => (
                    <td key={meses[i]} className="px-2 py-1 text-right whitespace-nowrap">
                      {v === 0 && (l.serie.quantidades[meses[i]] ?? 0) === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Link
                          href={hrefLancamentosDaSerie(l.serie, meses[i])}
                          className="hover:underline"
                          title={`Ver os lançamentos de ${l.serie.nome} em ${formatarMes(meses[i])}`}
                        >
                          {formatarMoeda(v)}
                        </Link>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-medium whitespace-nowrap">{formatarMoeda(l.total)}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">{formatarMoeda(l.media)}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <Variacao v={l} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="tabular-nums">
            <tr className="border-t-2 font-semibold">
              <th scope="row" className={cn(primeiraColuna, "px-2 py-1.5 text-left")}>
                Total Geral
              </th>
              {tabela.totais.map((v, i) => (
                <td key={meses[i]} className="px-2 py-1.5 text-right whitespace-nowrap">
                  {formatarMoeda(v)}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatarMoeda(tabela.totalGeral)}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatarMoeda(tabela.mediaGeral)}</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">
                <Variacao v={tabela.variacaoGeral} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Clique no nome para marcar ou desmarcar no gráfico; clique num valor para ver os lançamentos
        daquele mês. Variação: último mês do período contra o anterior.
      </p>
    </div>
  );
}

/** Esqueleto enquanto carrega. */
export function EvolucaoFornecedoresCarregando() {
  return (
    <div
      role="status"
      aria-label="Carregando a evolução por fornecedor..."
      className="space-y-3 rounded-xl border bg-card p-4"
    >
      <div className="h-5 w-64 animate-pulse rounded bg-muted" />
      <div className="h-8 w-full max-w-xl animate-pulse rounded bg-muted" />
      <div className="h-80 animate-pulse rounded-lg bg-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
