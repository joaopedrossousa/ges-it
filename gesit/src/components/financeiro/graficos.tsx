"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { TIPO_DESPESA_LABEL } from "@/lib/financeiro";
import { formatarMoeda } from "@/lib/format";
import { TIPOS_DESPESA, type TipoDespesa } from "@/lib/types";

/**
 * Cor fixa por tipo de despesa (tokens --despesa-* do globals.css, validados
 * para daltonismo no claro e no escuro). A cor segue o tipo, nunca a posição.
 */
const CONFIG_TIPOS = Object.fromEntries(
  TIPOS_DESPESA.map((t) => [
    t,
    { label: TIPO_DESPESA_LABEL[t], color: `var(--despesa-${t.replace("_", "-")})` },
  ]),
) as Record<TipoDespesa, { label: string; color: string }> satisfies ChartConfig;

const compacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "R$ 12,3 mil" (eixos e rótulos). */
const moedaCurta = (v: number) => compacto.format(v);

const MAX_ROTULO = 18;
const encurtar = (rotulo: string) =>
  rotulo.length > MAX_ROTULO ? `${rotulo.slice(0, MAX_ROTULO - 1).trimEnd()}…` : rotulo;

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------

function Moldura({
  titulo,
  resumo,
  legenda,
  children,
  tabela,
}: {
  titulo: string;
  resumo?: string;
  legenda?: ReactNode;
  children: ReactNode;
  tabela: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {resumo && <span className="text-sm text-muted-foreground tabular-nums">{resumo}</span>}
      </div>
      {legenda}
      {children}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Ver em tabela
        </summary>
        {tabela}
      </details>
    </section>
  );
}

function Amostra({ cor }: { cor: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: cor }} />;
}

/** Legenda dos tipos (sempre presente: cor nunca identifica sozinha). */
export function LegendaTipos({ tipos = TIPOS_DESPESA }: { tipos?: readonly TipoDespesa[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Legenda">
      {tipos.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <Amostra cor={CONFIG_TIPOS[t].color} />
          {CONFIG_TIPOS[t].label}
        </li>
      ))}
    </ul>
  );
}

function CaixaTooltip({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="grid min-w-44 gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{titulo}</p>
      {children}
    </div>
  );
}

function LinhaTooltip({ cor, rotulo, valor, forte }: {
  cor?: string;
  rotulo: string;
  valor: number;
  forte?: boolean;
}) {
  return (
    <p className={forte ? "flex justify-between gap-3 border-t pt-1" : "flex items-center justify-between gap-3"}>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {cor && <Amostra cor={cor} />}
        {rotulo}
      </span>
      <span className="font-mono font-medium tabular-nums">{formatarMoeda(valor)}</span>
    </p>
  );
}

function SemDados({ children }: { children: ReactNode }) {
  return (
    <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Evolução mensal (barras empilhadas por tipo)
// ---------------------------------------------------------------------------

export type MesGasto = {
  /** "AAAA-MM" */
  mes: string;
  /** "nov/26" */
  rotulo: string;
  /** "Novembro de 2026" */
  nome: string;
  total: number;
} & Record<TipoDespesa, number>;

type SegmentoProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  payload?: MesGasto;
};

/** Tipo no topo da pilha daquele mês (o último, na ordem fixa, com valor). */
function tipoDoTopo(p?: MesGasto) {
  return p ? [...TIPOS_DESPESA].reverse().find((t) => p[t] > 0) : undefined;
}

/** Segmento: só o topo da pilha tem os cantos arredondados (4px); a base fica reta. */
function Segmento({ x = 0, y = 0, width = 0, height = 0, fill, stroke, strokeWidth, payload, tipo }: SegmentoProps & { tipo: TipoDespesa }) {
  if (height <= 0 || width <= 0) return null;
  const r = tipoDoTopo(payload) === tipo ? Math.min(4, height, width / 2) : 0;
  const d = [
    `M${x},${y + height}`,
    `L${x},${y + r}`,
    r ? `Q${x},${y} ${x + r},${y}` : "",
    `L${x + width - r},${y}`,
    r ? `Q${x + width},${y} ${x + width},${y + r}` : "",
    `L${x + width},${y + height}`,
    "Z",
  ].join(" ");
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

/**
 * Últimos 12 meses, barras empilhadas por tipo (cancelados fora). Clicar
 * numa barra abre os lançamentos do mês.
 */
export function GraficoEvolucaoMensal({ meses }: { meses: MesGasto[] }) {
  const router = useRouter();
  const vazio = meses.every((m) => m.total === 0);
  const totalPeriodo = meses.reduce((s, m) => s + m.total, 0);
  const href = (mes: string) => `/financeiro/lancamentos?mes=${mes}`;

  function abrir(dados: unknown) {
    const mes = (dados as { payload?: MesGasto } | undefined)?.payload?.mes;
    if (mes) router.push(href(mes));
  }

  return (
    <Moldura
      titulo="Evolução Mensal"
      resumo={`${formatarMoeda(totalPeriodo)} em 12 meses`}
      legenda={<LegendaTipos />}
      tabela={
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-normal">Mês</th>
                {TIPOS_DESPESA.map((t) => (
                  <th key={t} className="py-1 text-right font-normal">
                    {TIPO_DESPESA_LABEL[t]}
                  </th>
                ))}
                <th className="py-1 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {meses.map((m) => (
                <tr key={m.mes} className="border-t">
                  <td className="py-1 whitespace-nowrap">
                    <Link href={href(m.mes)} className="hover:underline">
                      {m.nome}
                    </Link>
                  </td>
                  {TIPOS_DESPESA.map((t) => (
                    <td key={t} className="py-1 text-right whitespace-nowrap">
                      {formatarMoeda(m[t])}
                    </td>
                  ))}
                  <td className="py-1 text-right font-medium whitespace-nowrap">
                    {formatarMoeda(m.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <div className="relative">
        <ChartContainer
          config={CONFIG_TIPOS}
          className="aspect-auto h-72 w-full"
          role="img"
          aria-label={`Gastos por mês, últimos 12 meses: ${meses
            .map((m) => `${m.nome}, ${formatarMoeda(m.total)}`)
            .join("; ")}`}
        >
          <BarChart data={meses} margin={{ top: 20, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(v: number) => moedaCurta(v)}
              domain={vazio ? [0, 1000] : [0, "auto"]}
            />
            {!vazio && (
              <ChartTooltip
                cursor={{ fillOpacity: 0.5 }}
                content={({ active, payload }) => {
                  const m = payload?.[0]?.payload as MesGasto | undefined;
                  if (!active || !m) return null;
                  return (
                    <CaixaTooltip titulo={m.nome}>
                      {TIPOS_DESPESA.filter((t) => m[t] > 0).map((t) => (
                        <LinhaTooltip
                          key={t}
                          cor={CONFIG_TIPOS[t].color}
                          rotulo={CONFIG_TIPOS[t].label}
                          valor={m[t]}
                        />
                      ))}
                      <LinhaTooltip rotulo="Total" valor={m.total} forte />
                    </CaixaTooltip>
                  );
                }}
              />
            )}
            {TIPOS_DESPESA.map((t, i) => (
              <Bar
                key={t}
                dataKey={t}
                stackId="mes"
                fill={`var(--color-${t})`}
                stroke="var(--card)"
                strokeWidth={2}
                maxBarSize={36}
                cursor="pointer"
                onClick={abrir}
                shape={(p: unknown) => <Segmento {...(p as SegmentoProps)} tipo={t} />}
              >
                {/*
                  Total do mês sobre a pilha, uma vez: na última série, cujo
                  segmento (mesmo zerado) fica no topo do empilhamento.
                */}
                {i === TIPOS_DESPESA.length - 1 && (
                  <LabelList
                    dataKey="total"
                    position="top"
                    offset={6}
                    className="fill-muted-foreground"
                    fontSize={11}
                    formatter={(v: unknown) => (typeof v === "number" && v > 0 ? moedaCurta(v) : "")}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
        {vazio && <SemDados>Nenhum gasto nos últimos 12 meses</SemDados>}
      </div>
    </Moldura>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais (por tipo e por filial)
// ---------------------------------------------------------------------------

type BarraH = { chave: string; rotulo: string; valor: number; cor: string; href: string | null };

function BarrasHorizontais({
  titulo,
  barras,
  vazio,
  cabecalho,
  config,
}: {
  titulo: string;
  barras: BarraH[];
  vazio: string;
  cabecalho: string;
  config: ChartConfig;
}) {
  const router = useRouter();
  const total = barras.reduce((s, b) => s + b.valor, 0);
  const semDados = total === 0;
  const altura = Math.max(160, barras.length * 32 + 24);

  function abrir(dados: unknown) {
    const href = (dados as { payload?: BarraH } | undefined)?.payload?.href;
    if (href) router.push(href);
  }

  return (
    <Moldura
      titulo={titulo}
      resumo={formatarMoeda(total)}
      tabela={
        <table className="mt-2 w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-normal">{cabecalho}</th>
              <th className="py-1 text-right font-normal">Valor</th>
              <th className="py-1 text-right font-normal">% do Mês</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {barras.map((b) => (
              <tr key={b.chave} className="border-t">
                <td className="py-1">
                  {b.href ? (
                    <Link href={b.href} className="hover:underline">
                      {b.rotulo}
                    </Link>
                  ) : (
                    b.rotulo
                  )}
                </td>
                <td className="py-1 text-right">{formatarMoeda(b.valor)}</td>
                <td className="py-1 text-right">
                  {total > 0 ? `${Math.round((b.valor / total) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="relative">
        <ChartContainer
          config={config}
          className="aspect-auto w-full"
          style={{ height: altura }}
          role="img"
          aria-label={`${titulo}: ${barras.map((b) => `${b.rotulo}, ${formatarMoeda(b.valor)}`).join("; ")}`}
        >
          <BarChart data={barras} layout="vertical" margin={{ top: 0, right: 72, left: 4, bottom: 0 }}>
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => moedaCurta(v)}
              domain={semDados ? [0, 1000] : [0, "auto"]}
            />
            <YAxis
              type="category"
              dataKey="rotulo"
              tickLine={false}
              axisLine={false}
              width={132}
              interval={0}
              tickFormatter={encurtar}
            />
            {!semDados && (
              <ChartTooltip
                cursor={{ fillOpacity: 0.5 }}
                content={({ active, payload }) => {
                  const b = payload?.[0]?.payload as BarraH | undefined;
                  if (!active || !b) return null;
                  return (
                    <CaixaTooltip titulo={b.rotulo}>
                      <LinhaTooltip cor={b.cor} rotulo="Valor" valor={b.valor} />
                      {total > 0 && (
                        <p className="text-muted-foreground">
                          {Math.round((b.valor / total) * 100)}% do mês
                        </p>
                      )}
                    </CaixaTooltip>
                  );
                }}
              />
            )}
            <Bar
              dataKey="valor"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              cursor="pointer"
              onClick={abrir}
              // Cor por barra: a do tipo (Gastos por Tipo) ou uma só (filial).
              shape={(p: unknown) => {
                const props = p as SegmentoProps & { payload?: BarraH };
                const { x = 0, y = 0, width = 0, height = 0 } = props;
                if (width <= 0 || height <= 0) return <g />;
                const r = Math.min(4, width, height / 2);
                const d = `M${x},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} L${x},${y + height} Z`;
                return <path d={d} fill={props.payload?.cor} />;
              }}
            >
              <LabelList
                dataKey="valor"
                position="right"
                offset={6}
                className="fill-foreground"
                fontSize={11}
                formatter={(v: unknown) => (typeof v === "number" ? moedaCurta(v) : "")}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
        {semDados && <SemDados>{vazio}</SemDados>}
      </div>
    </Moldura>
  );
}

/** Gastos do mês por tipo (ordem fixa; tipos sem gasto aparecem zerados). */
export function GraficoGastosPorTipo({
  valores,
  mes,
}: {
  valores: Record<TipoDespesa, number>;
  mes: string;
}) {
  return (
    <BarrasHorizontais
      titulo="Gastos por Tipo"
      cabecalho="Tipo"
      vazio="Nenhum gasto no mês"
      config={CONFIG_TIPOS}
      barras={TIPOS_DESPESA.map((t) => ({
        chave: t,
        rotulo: TIPO_DESPESA_LABEL[t],
        valor: valores[t],
        cor: CONFIG_TIPOS[t].color,
        href: `/financeiro/lancamentos?mes=${mes}&tipo=${t}`,
      }))}
    />
  );
}

export type GastoFilial = { lojaId: string | null; loja: string; valor: number };

const CONFIG_FILIAL = { valor: { label: "Valor", color: "var(--chart-1)" } } satisfies ChartConfig;

/**
 * Gastos do mês por filial, do maior para o menor. Filiais sem lançamento
 * aparecem zeradas; lançamentos sem filial ficam em "Geral".
 */
export function GraficoGastosPorFilial({ filiais, mes }: { filiais: GastoFilial[]; mes: string }) {
  return (
    <BarrasHorizontais
      titulo="Gastos por Filial"
      cabecalho="Filial"
      vazio="Nenhum gasto no mês"
      config={CONFIG_FILIAL}
      barras={filiais.map((f) => ({
        chave: f.lojaId ?? "geral",
        rotulo: f.loja,
        valor: f.valor,
        cor: CONFIG_FILIAL.valor.color,
        href: f.lojaId ? `/financeiro/lancamentos?mes=${mes}&loja=${f.lojaId}` : null,
      }))}
    />
  );
}
