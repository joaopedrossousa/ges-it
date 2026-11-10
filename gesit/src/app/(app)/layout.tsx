import { LogOutIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NavLinks } from "@/components/layout/nav-links";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "./actions";

async function CurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // O proxy já redireciona; esta verificação é uma segunda barreira.
  if (!data?.claims) redirect("/login");

  const email = typeof data.claims.email === "string" ? data.claims.email : "";

  return (
    <span className="truncate text-sm text-muted-foreground" title={email}>
      {email}
    </span>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh w-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <span className="font-semibold">GesIT Produtécnica</span>
        </div>
        <div className="flex-1 p-3">
          <NavLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
          <span className="font-semibold md:hidden">GesIT</span>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <Suspense fallback={null}>
              <CurrentUser />
            </Suspense>
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
