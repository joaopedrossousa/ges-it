import type { ReactNode } from "react";

/** Par rótulo/valor para listas de dados (<dl>). */
export function CampoDetalhe({
  rotulo,
  children,
  mono,
}: {
  rotulo: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className={mono ? "font-mono" : undefined}>{children}</dd>
    </div>
  );
}
