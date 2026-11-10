import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { hrefPagina, POR_PAGINA } from "@/lib/busca";

const formatador = new Intl.NumberFormat("pt-BR");

type Props = {
  pathname: string;
  /** searchParams atuais (os filtros são mantidos nos links). */
  params: Record<string, string | string[] | undefined>;
  pagina: number;
  total: number;
  porPagina?: number;
  /** Ex.: ["usuário", "usuários"]. */
  rotulo: [singular: string, plural: string];
};

/** Páginas exibidas: 1 … p-1 p p+1 … última. */
function paginasVisiveis(atual: number, total: number): (number | "…")[] {
  const set = new Set([1, total, atual - 1, atual, atual + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const saida: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) saida.push("…");
    saida.push(n);
  });
  return saida;
}

/** Resumo "Mostrando a–b de N" + navegação por ?page= (mantendo filtros). */
export function Paginacao({
  pathname,
  params,
  pagina,
  total,
  porPagina = POR_PAGINA,
  rotulo: [singular, plural],
}: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const de = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ate = Math.min(pagina * porPagina, total);
  const href = (p: number) => hrefPagina(pathname, params, p);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? `0 ${plural}`
          : `Mostrando ${formatador.format(de)}–${formatador.format(ate)} de ${formatador.format(total)} ${total === 1 ? singular : plural}`}
      </p>

      {totalPaginas > 1 && (
        <nav aria-label="Paginação" className="flex flex-wrap items-center gap-1">
          {pagina > 1 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={href(pagina - 1)} aria-label="Página anterior">
                <ChevronLeftIcon />
                Anterior
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled aria-label="Página anterior">
              <ChevronLeftIcon />
              Anterior
            </Button>
          )}

          {paginasVisiveis(pagina, totalPaginas).map((p, i) =>
            p === "…" ? (
              <span key={`r${i}`} className="px-1 text-sm text-muted-foreground" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={p}
                asChild
                variant={p === pagina ? "outline" : "ghost"}
                size="icon-sm"
              >
                <Link
                  href={href(p)}
                  aria-label={`Página ${p}`}
                  aria-current={p === pagina ? "page" : undefined}
                >
                  {p}
                </Link>
              </Button>
            ),
          )}

          {pagina < totalPaginas ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={href(pagina + 1)} aria-label="Próxima página">
                Próxima
                <ChevronRightIcon />
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled aria-label="Próxima página">
              Próxima
              <ChevronRightIcon />
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}

/** Aviso para ?page= além da última página (o PostgREST responde 416). */
export function PaginaInexistente({
  pathname,
  params,
}: Pick<Props, "pathname" | "params">) {
  return (
    <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
      Esta página não existe para os filtros atuais.{" "}
      <Link href={hrefPagina(pathname, params, 1)} className="text-primary hover:underline">
        Ir para a primeira página
      </Link>
    </div>
  );
}
