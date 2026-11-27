import { LogOutIcon } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { NavLinks } from "@/components/layout/nav-links";
import { RastreadorNavegacao } from "@/components/layout/rastreador-navegacao";
import { SeletorTema } from "@/components/tema/seletor-tema";
import { Button } from "@/components/ui/button";
import { obterClaims } from "@/lib/sessao";

import { signOut } from "./actions";

function Marca() {
  return (
    <span className="flex items-center gap-2">
      {/* O azul da marca some no fundo escuro: no tema escuro, a versão clara. */}
      <Image
        src="/brand/simbolo.png"
        alt=""
        width={24}
        height={24}
        className="size-6 dark:hidden"
      />
      <Image
        src="/brand/simbolo-escuro.png"
        alt=""
        width={24}
        height={24}
        className="hidden size-6 dark:block"
      />
      <span className="font-bold tracking-tight text-brand-navy dark:text-foreground">GesIT</span>
    </span>
  );
}

async function CurrentUser() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  // Mesma leitura (cache por requisição) usada pelas páginas e blocos.
  const claims = await obterClaims();

  // O proxy já redireciona; esta verificação é uma segunda barreira.
  if (!claims) redirect("/login");

  const email = typeof claims.email === "string" ? claims.email : "";

  return (
    <span className="truncate text-sm text-muted-foreground" title={email}>
      {email}
    </span>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh w-full">
      <RastreadorNavegacao />
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        {/* Faixa da marca no topo do menu. */}
        <div className="h-1 bg-brand-blue" aria-hidden />
        <div className="flex h-13 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <Marca />
          <span className="text-xs text-muted-foreground">Produtécnica</span>
        </div>
        <div className="flex-1 p-3">
          <NavLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-t-4 border-b border-t-brand-blue px-4 md:border-t-0">
          <span className="md:hidden">
            <Marca />
          </span>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <Suspense fallback={null}>
              <CurrentUser />
            </Suspense>
            <SeletorTema />
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                <LogOutIcon />
                Sair
              </Button>
            </form>
          </div>
        </header>

        <div className="border-b px-2 py-2 md:hidden">
          <NavLinks orientation="horizontal" />
        </div>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
