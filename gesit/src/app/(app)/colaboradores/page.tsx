import type { Metadata } from "next";

export const metadata: Metadata = { title: "Usuários" };

export default function ColaboradoresPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
      <p className="text-muted-foreground">Em breve: cadastro de usuários.</p>
    </div>
  );
}
