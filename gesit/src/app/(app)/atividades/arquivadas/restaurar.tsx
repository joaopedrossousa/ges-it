"use client";

import { ArchiveRestoreIcon, ChevronDownIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { PontoCor } from "@/components/atividades/etiquetas";
import { Carregando } from "@/components/carregando";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColunaQuadro } from "@/lib/atividades";
import { executarAcao } from "@/lib/executar-acao";

import { restaurarAtividade, restaurarColuna } from "../actions";

/**
 * Restaura a atividade no fim de uma coluna ativa. A coluna em que ela estava
 * vem primeiro (se ainda estiver ativa).
 */
export function RestaurarAtividade({
  atividade,
  colunas,
}: {
  atividade: { id: string; titulo: string; coluna_id: string };
  colunas: ColunaQuadro[];
}) {
  const [isPending, startTransition] = useTransition();
  const original = colunas.find((c) => c.id === atividade.coluna_id);
  const outras = colunas.filter((c) => c.id !== atividade.coluna_id);

  function restaurar(coluna: ColunaQuadro) {
    startTransition(async () => {
      const r = await executarAcao(() => restaurarAtividade(atividade.id, coluna.id));
      if (!r.ok) toast.error("Não foi possível restaurar.", { description: r.error });
      else toast.success(`Atividade restaurada em "${coluna.nome}".`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending || colunas.length === 0}>
          {isPending ? <Carregando decorativo tamanho="sm" /> : <ArchiveRestoreIcon />}
          Restaurar<span className="sr-only"> {atividade.titulo}</span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Restaurar na coluna</DropdownMenuLabel>
        {original && (
          <DropdownMenuItem onSelect={() => restaurar(original)}>
            <PontoCor cor={original.cor} />
            {original.nome} (onde estava)
          </DropdownMenuItem>
        )}
        {original && outras.length > 0 && <DropdownMenuSeparator />}
        {outras.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => restaurar(c)}>
            <PontoCor cor={c.cor} />
            {c.nome}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A coluna volta para o fim do quadro. */
export function RestaurarColuna({ coluna }: { coluna: { id: string; nome: string } }) {
  const [isPending, startTransition] = useTransition();

  function restaurar() {
    startTransition(async () => {
      const r = await executarAcao(() => restaurarColuna(coluna.id));
      if (!r.ok) toast.error("Não foi possível restaurar.", { description: r.error });
      else toast.success(`Coluna "${coluna.nome}" restaurada no fim do quadro.`);
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={restaurar} disabled={isPending}>
      {isPending ? <Carregando decorativo tamanho="sm" /> : <ArchiveRestoreIcon />}
      Restaurar<span className="sr-only"> {coluna.nome}</span>
    </Button>
  );
}
