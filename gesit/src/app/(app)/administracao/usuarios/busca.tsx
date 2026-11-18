"use client";

import { CampoBusca } from "@/components/campo-busca";
import { Carregando } from "@/components/carregando";
import { useFiltrosUrl } from "@/hooks/use-filtros-url";

/** Busca por nome ou e-mail (?q, filtrada no servidor). */
export function BuscaUsuarios() {
  const { valor, atualizar, isPending } = useFiltrosUrl();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CampoBusca
        valorInicial={valor("q", "")}
        placeholder="Buscar por nome ou e-mail"
        onBuscar={(q) => atualizar("q", q)}
      />
      {isPending && <Carregando rotulo="Atualizando..." tamanho="sm" />}
    </div>
  );
}
