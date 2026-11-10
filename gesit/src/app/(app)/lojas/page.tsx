import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lojas" };

export default function LojasPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Lojas</h1>
      <p className="text-muted-foreground">Em breve: cadastro de lojas.</p>
    </div>
  );
}
