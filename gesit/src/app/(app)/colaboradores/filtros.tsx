"use client";

import { CampoBusca } from "@/components/campo-busca";
import { Carregando } from "@/components/carregando";
import { ComboboxLista } from "@/components/combobox-lista";
import { useFiltrosUrl } from "@/hooks/use-filtros-url";
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

      {isPending && <Carregando rotulo="Atualizando..." tamanho="sm" />}
    </div>
  );
}
