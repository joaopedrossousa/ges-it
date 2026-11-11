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
import {
  SITUACAO_VIDA_UTIL_LABEL,
  SITUACOES_VIDA_UTIL_FILTRO,
  STATUS_DISPOSITIVO,
  STATUS_DISPOSITIVO_LABEL,
  TIPOS_DISPOSITIVO,
  TIPO_DISPOSITIVO_LABEL,
} from "@/lib/types";

export function Filtros({ lojas }: { lojas: LojaOpcao[] }) {
  const { valor, atualizar, isPending } = useFiltrosUrl();

  // Sem espaço para a busca (mín. 320px) ao lado, os selects descem de linha.
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      <CampoBusca
        valorInicial={valor("q", "")}
        placeholder="Buscar por marca, modelo, serial, IMEI, patrimônio ou linha"
        onBuscar={(q) => atualizar("q", q)}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:flex">
        <Select value={valor("tipo")} onValueChange={(v) => atualizar("tipo", v)}>
          <SelectTrigger className="w-full lg:w-36" aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {TIPOS_DISPOSITIVO.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_DISPOSITIVO_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={valor("status")} onValueChange={(v) => atualizar("status", v)}>
          <SelectTrigger className="w-full lg:w-40" aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            {STATUS_DISPOSITIVO.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_DISPOSITIVO_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={valor("vida")} onValueChange={(v) => atualizar("vida", v)}>
          <SelectTrigger className="w-full lg:w-44" aria-label="Filtrar por situação da vida útil">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Vida útil: todas</SelectItem>
            {SITUACOES_VIDA_UTIL_FILTRO.map((s) => (
              <SelectItem key={s} value={s}>
                {SITUACAO_VIDA_UTIL_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ComboboxLista
          opcoes={opcoesLojas(lojas, { todas: true })}
          value={valor("loja")}
          onChange={(v) => atualizar("loja", v)}
          ariaLabel="Filtrar pela loja do usuário atual"
          placeholderBusca="Buscar loja ou cidade..."
          vazio="Nenhuma loja encontrada."
          className="lg:w-52"
        />
      </div>

      {isPending && <Carregando rotulo="Atualizando..." tamanho="sm" />}
    </div>
  );
}
