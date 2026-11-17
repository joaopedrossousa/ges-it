"use client";

import { Carregando } from "@/components/carregando";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS, useFiltrosUrl } from "@/hooks/use-filtros-url";
import { TIPO_DESPESA_LABEL } from "@/lib/financeiro";
import { TIPOS_DESPESA } from "@/lib/types";

export function FiltrosServicos() {
  const { valor, atualizar, isPending } = useFiltrosUrl();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={valor("tipo")} onValueChange={(v) => atualizar("tipo", v)}>
        <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por tipo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os tipos</SelectItem>
          {TIPOS_DESPESA.map((t) => (
            <SelectItem key={t} value={t}>
              {TIPO_DESPESA_LABEL[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={valor("ativo")} onValueChange={(v) => atualizar("ativo", v)}>
        <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Ativos e inativos</SelectItem>
          <SelectItem value="sim">Só ativos</SelectItem>
          <SelectItem value="nao">Só inativos</SelectItem>
        </SelectContent>
      </Select>

      {isPending && <Carregando rotulo="Atualizando..." tamanho="sm" />}
    </div>
  );
}
