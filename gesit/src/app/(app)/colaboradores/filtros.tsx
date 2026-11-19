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
import { useFiltrosUrl } from "@/hooks/use-filtros-url";
import { OPCOES_SITUACAO_COLABORADOR, SITUACAO_PADRAO } from "@/lib/colaboradores";
import { lerFiltrosColaboradores } from "@/lib/filtros-colaboradores";
import type { LojaOpcao } from "@/lib/lojas";
import { opcoesLojas } from "@/lib/opcoes-lojas";

export function Filtros({ lojas }: { lojas: LojaOpcao[] }) {
  const { valor, atualizar, isPending } = useFiltrosUrl();
  // Mesma leitura do servidor (valor inválido = "ativos").
  const { situacao } = lerFiltrosColaboradores({ situacao: valor("situacao", "") });

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

      <Select value={situacao} onValueChange={(v) => atualizar("situacao", v, SITUACAO_PADRAO)}>
        <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por situação">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPCOES_SITUACAO_COLABORADOR.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isPending && <Carregando rotulo="Atualizando..." tamanho="sm" />}
    </div>
  );
}
