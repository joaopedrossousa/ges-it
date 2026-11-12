"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { TIPO_DISPOSITIVO_PLURAL, type TipoDispositivo } from "@/lib/types";

export type BarraFilial = {
  lojaId: string;
  /** Nome completo (tooltip e tabela). */
  loja: string;
  /** Nome curto do eixo: a cidade da loja. */
  rotulo: string;
  em_uso: number;
  em_estoque: number;
  total: number;
};

/** Em uso no azul da marca, estoque no verde (tokens --chart-1 e --chart-2). */
const CONFIG = {
  em_uso: { label: "Em uso", color: "var(--chart-1)" },
  em_estoque: { label: "Em estoque", color: "var(--chart-2)" },
} satisfies ChartConfig;

const formatador = new Intl.NumberFormat("pt-BR");

/** Eixo X inclinado tem pouco espaço: nome longo vira "Paraíso do T…" (o completo fica no tooltip). */
const MAX_ROTULO = 12;
const encurtar = (rotulo: string) =>
  rotulo.length > MAX_ROTULO ? `${rotulo.slice(0, MAX_ROTULO - 1).trimEnd()}…` : rotulo;

/** Legenda única da seção (os três gráficos usam as mesmas cores). */
export function LegendaAtivosFilial() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Legenda">
      {(["em_uso", "em_estoque"] as const).map((chave) => (
        <li key={chave} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-[3px]"
            style={{ background: CONFIG[chave].color }}
          />
          {CONFIG[chave].label}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  tipo: TipoDispositivo;
  barras: BarraFilial[];
  /** Aparelhos sem vínculo e sem filial de estoque (fora do gráfico). */
  semFilial: number;
};

/**
 * Barras empilhadas por filial (em uso + em estoque) de um tipo de
 * dispositivo. Clicar numa barra abre /dispositivos filtrado.
 */
export function GraficoAtivosFilial({ tipo, barras, semFilial }: Props) {
  const router = useRouter();
  const total = barras.reduce((soma, b) => soma + b.total, 0);
  const plural = TIPO_DISPOSITIVO_PLURAL[tipo];
  const titulo = plural.charAt(0).toUpperCase() + plural.slice(1);
  const vazio = total === 0;
  const href = (lojaId: string) => `/dispositivos?tipo=${tipo}&loja=${lojaId}`;

  function abrir(dados: unknown) {
    const lojaId = (dados as { payload?: BarraFilial } | undefined)?.payload?.lojaId;
    if (lojaId) router.push(href(lojaId));
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">{titulo}</h3>
        <span className="text-sm text-muted-foreground">
          {formatador.format(total)} {total === 1 ? "aparelho" : "aparelhos"}
        </span>
      </div>

      <div className="relative">
        <ChartContainer
          config={CONFIG}
          className="aspect-auto h-64 w-full"
          role="img"
          aria-label={`${titulo} por filial: ${barras
            .filter((b) => b.total > 0)
            .map((b) => `${b.loja}, ${b.em_uso} em uso e ${b.em_estoque} em estoque`)
            .join("; ") || "nenhum"}`}
        >
          <BarChart data={barras} margin={{ top: 20, right: 4, left: 20, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-40}
              textAnchor="end"
              height={64}
              tickMargin={4}
              tickFormatter={encurtar}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              domain={vazio ? [0, 4] : [0, "auto"]}
            />
            {!vazio && (
              <ChartTooltip
                cursor={{ fillOpacity: 0.5 }}
                content={({ active, payload }) => {
                  const b = payload?.[0]?.payload as BarraFilial | undefined;
                  if (!active || !b) return null;
                  return (
                    <div className="grid min-w-36 gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                      <p className="font-medium">{b.loja}</p>
                      {(["em_uso", "em_estoque"] as const).map((chave) => (
                        <p key={chave} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                              aria-hidden
                              className="size-2.5 rounded-[2px]"
                              style={{ background: CONFIG[chave].color }}
                            />
                            {CONFIG[chave].label}
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {formatador.format(b[chave])}
                          </span>
                        </p>
                      ))}
                      <p className="flex justify-between gap-3 border-t pt-1">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-mono font-medium tabular-nums">
                          {formatador.format(b.total)}
                        </span>
                      </p>
                    </div>
                  );
                }}
              />
            )}
            {/* Gap de 2px na cor do card entre os segmentos; topo arredondado. */}
            <Bar
              dataKey="em_uso"
              stackId="a"
              fill="var(--color-em_uso)"
              stroke="var(--card)"
              strokeWidth={2}
              maxBarSize={24}
              cursor="pointer"
              onClick={abrir}
              shape={(p: unknown) => <Segmento {...(p as SegmentoProps)} topo="em_uso" />}
            />
            <Bar
              dataKey="em_estoque"
              stackId="a"
              fill="var(--color-em_estoque)"
              stroke="var(--card)"
              strokeWidth={2}
              maxBarSize={24}
              cursor="pointer"
              onClick={abrir}
              shape={(p: unknown) => <Segmento {...(p as SegmentoProps)} topo="em_estoque" />}
            >
              <LabelList
                dataKey="total"
                position="top"
                offset={6}
                className="fill-foreground"
                fontSize={12}
                formatter={(v: unknown) => (typeof v === "number" && v > 0 ? formatador.format(v) : "")}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
        {vazio && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">
            Nenhum {tipo} cadastrado
          </p>
        )}
      </div>

      {semFilial > 0 && (
        <p className="text-xs text-muted-foreground">
          {semFilial} {semFilial === 1 ? tipo : plural} sem filial de estoque (fora do gráfico).
        </p>
      )}

      {!vazio && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Ver em tabela
          </summary>
          <table className="mt-2 w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-normal">Filial</th>
                <th className="py-1 text-right font-normal">Em uso</th>
                <th className="py-1 text-right font-normal">Em estoque</th>
                <th className="py-1 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {barras.map((b) => (
                <tr key={b.lojaId} className="border-t">
                  <td className="py-1">
                    <Link href={href(b.lojaId)} className="hover:underline">
                      {b.loja}
                    </Link>
                  </td>
                  <td className="py-1 text-right">{b.em_uso}</td>
                  <td className="py-1 text-right">{b.em_estoque}</td>
                  <td className="py-1 text-right font-medium">{b.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

type SegmentoProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  payload?: BarraFilial;
  topo: "em_uso" | "em_estoque";
};

/**
 * Segmento da pilha: arredonda (4px) só o topo da barra, que é o estoque
 * ou, sem estoque, o "em uso". A base fica reta.
 */
function Segmento({ x = 0, y = 0, width = 0, height = 0, fill, stroke, strokeWidth, payload, topo }: SegmentoProps) {
  if (height <= 0 || width <= 0) return null;
  const ehTopo = topo === "em_estoque" || (payload?.em_estoque ?? 0) === 0;
  const r = ehTopo ? Math.min(4, height, width / 2) : 0;
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
