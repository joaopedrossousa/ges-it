import { cn } from "cn";
import { ChevronRightIcon, CircleCheckIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  titulo: string;
  icone: LucideIcon;
  /** Cor do ícone do título (status). */
  corIcone?: string;
  descricao?: ReactNode;
  /** Link do cabeçalho ("Ver quadro", "Ver lançamentos"...). */
  acao?: { href: string; rotulo: string };
  children: ReactNode;
  className?: string;
  /**
   * Destaque (bloco Urgentes com itens): fundo e contorno no vermelho pastel
   * das colunas do Kanban (--coluna-vermelho), faixa à esquerda e título no
   * texto vermelho das etiquetas (contraste validado nos dois temas).
   */
  destaque?: boolean;
};

/** Classes do destaque, por extenso (o Tailwind precisa encontrá-las). */
const DESTAQUE =
  "border-l-4 border-l-etiqueta-vermelho-texto/60 bg-coluna-vermelho ring-coluna-vermelho-borda";

/** Cartão de um bloco da tela Início. */
export function Bloco({
  titulo,
  icone: Icone,
  corIcone,
  descricao,
  acao,
  children,
  className,
  destaque,
}: Props) {
  return (
    <Card className={cn("min-w-0", destaque && DESTAQUE, className)}>
      <CardHeader>
        <CardTitle
          className={cn("flex items-center gap-2", destaque && "text-etiqueta-vermelho-texto")}
        >
          <Icone
            className={cn(
              "size-4 shrink-0 text-muted-foreground",
              corIcone,
              destaque && "text-etiqueta-vermelho-texto",
            )}
            aria-hidden
          />
          {titulo}
        </CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
        {acao && (
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href={acao.href}>
                {acao.rotulo}
                <ChevronRightIcon />
              </Link>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Estado vazio: nada pedindo atenção. */
export function TudoEmDia({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-brand-green/15 px-3 py-2.5 text-sm text-brand-green-strong dark:bg-brand-green/20">
      <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold">Tudo em dia.</strong> {children}
      </span>
    </p>
  );
}

/** Erro de um bloco: os demais continuam funcionando. */
export function ErroBloco({ titulo, icone }: { titulo: string; icone: LucideIcon }) {
  return (
    <Bloco titulo={titulo} icone={icone}>
      <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
        Não foi possível carregar este bloco. Atualize a página para tentar de novo.
      </p>
    </Bloco>
  );
}

/** Esqueleto enquanto o bloco carrega (fallback do Suspense). */
export function BlocoCarregando({
  titulo,
  icone,
  linhas = 4,
  destaque,
}: {
  titulo: string;
  icone: LucideIcon;
  linhas?: number;
  destaque?: boolean;
}) {
  return (
    <Bloco titulo={titulo} icone={icone} destaque={destaque}>
      <div className="space-y-3" role="status" aria-label={`Carregando ${titulo}...`}>
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="h-9 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </Bloco>
  );
}

/**
 * Lista de itens clicáveis, com divisórias. `grade`: em telas largas, os
 * itens se dividem em duas colunas (blocos de largura total).
 */
export function ListaBloco({ children, grade }: { children: ReactNode; grade?: boolean }) {
  return (
    <ul
      className={cn(
        "-mx-2",
        grade ? "grid gap-x-6 lg:grid-cols-2 [&>li]:border-b" : "divide-y",
      )}
    >
      {children}
    </ul>
  );
}

/** Item clicável da lista (o link ocupa a linha inteira). */
export function ItemBloco({
  href,
  ancora,
  children,
}: {
  href: string;
  /** <a> em vez de <Link>: navegação completa até o #id (lançamentos, ver CLAUDE.md). */
  ancora?: boolean;
  children: ReactNode;
}) {
  const classe =
    "flex items-start gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
  return (
    <li>
      {ancora ? (
        <a href={href} className={classe}>
          {children}
        </a>
      ) : (
        <Link href={href} className={classe}>
          {children}
        </Link>
      )}
    </li>
  );
}

/**
 * Para o `.catch` dos carregadores: registra o erro e devolve null (o bloco
 * mostra ErroBloco e os demais seguem normais).
 */
export function falhaDoBloco(titulo: string) {
  return (e: unknown) => {
    console.error(`Erro no bloco "${titulo}":`, e);
    return null;
  };
}
