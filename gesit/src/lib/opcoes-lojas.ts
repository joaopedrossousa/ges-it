import type { OpcaoLista } from "@/components/combobox-lista";
import { TODOS } from "@/hooks/use-filtros-url";
import type { LojaOpcao } from "@/lib/lojas";

/**
 * Lojas para o ComboboxLista: a cidade aparece embaixo do nome e também
 * entra na busca ("gur" acha "Filial Gurupi" pelo nome ou pela cidade).
 * Com `todas`, a primeira opção é "Todas as lojas" (valor TODOS, dos filtros).
 */
export function opcoesLojas(lojas: LojaOpcao[], { todas = false } = {}): OpcaoLista[] {
  const opcoes = lojas.map((l) => ({
    value: l.id,
    label: l.ativo ? l.nome : `${l.nome} (inativa)`,
    descricao: l.cidade ?? undefined,
  }));
  return todas ? [{ value: TODOS, label: "Todas as lojas" }, ...opcoes] : opcoes;
}
