import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dispositivos" };

export default function DispositivosPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Dispositivos</h1>
      <p className="text-muted-foreground">
        Em breve: cadastro de dispositivos.
      </p>
    </div>
  );
}
