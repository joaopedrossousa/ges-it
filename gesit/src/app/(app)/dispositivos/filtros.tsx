"use client";

import { Loader2Icon } from "lucide-react";

import { CampoBusca } from "@/components/campo-busca";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS, useFiltrosUrl } from "@/hooks/use-filtros-url";
import type { LojaOpcao } from "@/lib/lojas";
import {
  STATUS_DISPOSITIVO,
  STATUS_DISPOSITIVO_LABEL,
  TIPOS_DISPOSITIVO,
  TIPO_DISPOSITIVO_LABEL,
} from "@/lib/types";

export function Filtros({ lojas }: { lojas: LojaOpcao[] }) {
  const { valor, atualizar, isPending } = useFiltrosUrl();

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <CampoBusca
        valorInicial={valor("q", "")}
        placeholder="Buscar por marca, modelo, serial ou IMEI"
        onBuscar={(q) => atualizar("q", q)}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
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

        <Select value={valor("loja")} onValueChange={(v) => atualizar("loja", v)}>
          <SelectTrigger
            className="w-full lg:w-52"
            aria-label="Filtrar pela loja do usuário atual"
          >
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
      </div>

      {isPending && (
        <Loader2Icon
          className="size-4 animate-spin text-muted-foreground"
          aria-label="Atualizando..."
        />
      )}
    </div>
  );
}
