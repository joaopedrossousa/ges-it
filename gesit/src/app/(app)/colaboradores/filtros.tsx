"use client";

import { CampoBusca } from "@/components/campo-busca";
import { Carregando } from "@/components/carregando";
import { ComboboxLista } from "@/components/combobox-lista";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS, useFiltrosUrl } from "@/hooks/use-filtros-url";
import type { LojaOpcao } from "@/lib/lojas";
import { opcoesLojas } from "@/lib/opcoes-lojas";

export function Filtros({ lojas }: { lojas: LojaOpcao[] }) {
  const { valor, atualizar, isPending } = useFiltrosUrl();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <CampoBusca
        valorInicial={valor("q", "")}
        placeholder="Buscar por nome, cargo, CPF ou e-mail"
        onBuscar={(q) => atualizar("q", q)}
      />

      <ComboboxLista
        opcoes={opcoesLojas(lojas, { todas: true })}
        value={valor("loja")}
        onChange={(v) => atualizar("loja", v)}
        ariaLabel="Filtrar por loja"
        placeholderBusca="Buscar loja ou cidade..."
        vazio="Nenhuma loja encontrada."
        className="sm:w-56 sm:shrink-0"
      />

      <Select value={valor("pendentes")} onValueChange={(v) => atualizar("pendentes", v)}>
        <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por dados do cadastro">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os cadastros</SelectItem>
          <SelectItem value="1">Dados pendentes</SelectItem>
        </SelectContent>
      </Select>

      {isPending && <Carregando rotulo="Atualizando..." tamanho="sm" />}
    </div>
  );
}
