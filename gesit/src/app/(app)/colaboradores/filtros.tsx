"use client";

import { CampoBusca } from "@/components/campo-busca";
import { Carregando } from "@/components/carregando";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS, useFiltrosUrl } from "@/hooks/use-filtros-url";
import type { LojaOpcao } from "@/lib/lojas";

export function Filtros({ lojas }: { lojas: LojaOpcao[] }) {
  const { valor, atualizar, isPending } = useFiltrosUrl();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <CampoBusca
        valorInicial={valor("q", "")}
        placeholder="Buscar por nome, cargo, CPF ou e-mail"
        onBuscar={(q) => atualizar("q", q)}
      />

      <Select value={valor("loja")} onValueChange={(v) => atualizar("loja", v)}>
        <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por loja">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas as lojas</SelectItem>
          {lojas.map((loja) => (
            <SelectItem key={loja.id} value={loja.id}>
              {loja.nome}
              {!loja.ativo && " (inativa)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isPending && <Carregando rotulo="Atualizando..." tamanho="sm" />}
    </div>
  );
}
