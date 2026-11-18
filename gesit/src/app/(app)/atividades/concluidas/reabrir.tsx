"use client";

import { ArchiveRestoreIcon, ChevronDownIcon, RotateCcwIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { AmostraCor } from "@/components/atividades/etiquetas";
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
 * Reabre a atividade concluída no fim de uma coluna ativa (no banco,
 * restaurar_atividade). A coluna de origem vem primeiro, se ainda estiver ativa.
 */
export function ReabrirAtividade({
  atividade,
  colunas,
}: {
  atividade: { id: string; titulo: string; coluna_id: string };
  colunas: ColunaQuadro[];
}) {
  const [isPending, startTransition] = useTransition();
  const original = colunas.find((c) => c.id === atividade.coluna_id);
  const outras = colunas.filter((c) => c.id !== atividade.coluna_id);

  function reabrir(coluna: ColunaQuadro) {
    startTransition(async () => {
      const r = await executarAcao(() => restaurarAtividade(atividade.id, coluna.id));
      if (!r.ok) toast.error("Não foi possível reabrir.", { description: r.error });
      else toast.success(`Atividade reaberta em "${coluna.nome}".`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending || colunas.length === 0}
          title={colunas.length === 0 ? "Não há colunas ativas no quadro" : undefined}
        >
          {isPending ? <Carregando decorativo tamanho="sm" /> : <RotateCcwIcon />}
          Reabrir<span className="sr-only"> {atividade.titulo}</span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Reabrir na coluna</DropdownMenuLabel>
        {original && (
          <DropdownMenuItem onSelect={() => reabrir(original)}>
            <AmostraCor cor={original.cor} />
            {original.nome} (de origem)
          </DropdownMenuItem>
        )}
        {original && outras.length > 0 && <DropdownMenuSeparator />}
        {outras.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => reabrir(c)}>
            <AmostraCor cor={c.cor} />
            {c.nome}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Coluna arquivada: volta para o fim do quadro. */
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
