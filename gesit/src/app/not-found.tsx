import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada" };

/** Endereço que não corresponde a nenhuma rota. */
export default function PaginaNaoEncontrada() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-5xl font-semibold text-muted-foreground">404</p>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Página não encontrada</h1>
        <p className="text-muted-foreground">Confira o endereço digitado.</p>
      </div>
      <Button asChild>
        <Link href="/">Ir para o Dashboard</Link>
      </Button>
    </main>
  );
}
