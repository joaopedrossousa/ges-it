"use client";

import { cn } from "cn";
import {
  ChevronDownIcon,
  FileChartColumnIcon,
  FileSpreadsheetIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MonitorSmartphoneIcon,
  ReceiptTextIcon,
  StoreIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Só a rota exata (o Dashboard e o Painel são prefixo das outras). */
  exato?: boolean;
};

type Grupo = { id: string; label: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  {
    id: "ativos",
    label: "Ativos e Imobilizados",
    itens: [
      { href: "/", label: "Dashboard", icon: LayoutDashboardIcon, exato: true },
      { href: "/colaboradores", label: "Usuários", icon: UsersIcon },
      { href: "/dispositivos", label: "Dispositivos", icon: MonitorSmartphoneIcon },
      { href: "/relatorios", label: "Relatórios", icon: FileChartColumnIcon },
    ],
  },
  {
    id: "financeiro",
    label: "Gestão Financeira",
    itens: [
      { href: "/financeiro", label: "Painel", icon: WalletIcon, exato: true },
      { href: "/financeiro/lancamentos", label: "Lançamentos", icon: ReceiptTextIcon },
      { href: "/financeiro/servicos", label: "Serviços e fornecedores", icon: ListChecksIcon },
      { href: "/financeiro/relatorios", label: "Relatórios", icon: FileSpreadsheetIcon },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    itens: [
      { href: "/lojas", label: "Lojas", icon: StoreIcon },
      { href: "/auditoria", label: "Auditoria", icon: HistoryIcon },
    ],
  },
];

function isActive(pathname: string, { href, exato }: Item) {
  return exato ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function grupoDaRota(pathname: string | null) {
  if (pathname === null) return undefined;
  return GRUPOS.find((g) => g.itens.some((i) => isActive(pathname, i)))?.id;
}

type Orientation = "vertical" | "horizontal";

/**
 * Em rotas dinâmicas o pathname só existe em tempo de execução; o fallback
 * (menu sem item destacado) entra no shell estático pré-renderizado.
 */
export function NavLinks({ orientation = "vertical" }: { orientation?: Orientation }) {
  return (
    <Suspense fallback={<Links orientation={orientation} pathname={null} />}>
      <LinksComDestaque orientation={orientation} />
    </Suspense>
  );
}

function LinksComDestaque({ orientation }: { orientation: Orientation }) {
  return <Links orientation={orientation} pathname={usePathname()} />;
}

function Links({ orientation, pathname }: { orientation: Orientation; pathname: string | null }) {
  // No celular (faixa horizontal) não há grupos: todos os links em sequência.
  if (orientation === "horizontal") {
    return (
      <nav aria-label="Menu principal" className="flex flex-row gap-1 overflow-x-auto">
        {GRUPOS.flatMap((g) => g.itens).map((item) => (
          <LinkItem key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    );
  }
  return <MenuAgrupado pathname={pathname} />;
}

function MenuAgrupado({ pathname }: { pathname: string | null }) {
  const atual = grupoDaRota(pathname);
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(atual ? [atual] : []));
  // Ao navegar para outro grupo, ele abre sozinho (os demais ficam como estão).
  // Ajuste durante a renderização, sem efeito: https://react.dev/learn/you-might-not-need-an-effect
  const [grupoVisto, setGrupoVisto] = useState(atual);
  if (atual !== grupoVisto) {
    setGrupoVisto(atual);
    if (atual && !abertos.has(atual)) setAbertos(new Set(abertos).add(atual));
  }

  function alternar(id: string) {
    const novo = new Set(abertos);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setAbertos(novo);
  }

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-3">
      {GRUPOS.map((g) => {
        const aberto = abertos.has(g.id);
        const listaId = `menu-grupo-${g.id}`;
        return (
          <div key={g.id} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => alternar(g.id)}
              aria-expanded={aberto}
              aria-controls={listaId}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold tracking-wide uppercase transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                atual === g.id ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {g.label}
              <ChevronDownIcon
                aria-hidden
                className={cn("size-4 shrink-0 transition-transform", !aberto && "-rotate-90")}
              />
            </button>
            <div id={listaId} hidden={!aberto} className="flex flex-col gap-1">
              {g.itens.map((item) => (
                <LinkItem key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function LinkItem({ item, pathname }: { item: Item; pathname: string | null }) {
  const active = pathname !== null && isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  );
}
