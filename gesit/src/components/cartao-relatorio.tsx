import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Card de um relatório: título, descrição, filtros e os botões de exportar no rodapé. */
export function CartaoRelatorio({
  icone: Icone,
  titulo,
  descricao,
  children,
  rodape,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  children?: ReactNode;
  rodape: ReactNode;
}) {
  return (
    <Card className="border-t-2 border-t-brand-green">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icone className="size-4 text-brand-green" aria-hidden />
          {titulo}
        </CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="grid flex-1 content-start gap-4">{children}</CardContent>
      <CardFooter>{rodape}</CardFooter>
    </Card>
  );
}
