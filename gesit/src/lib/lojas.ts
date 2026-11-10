import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type LojaOpcao = { id: string; nome: string; ativo: boolean };

/**
 * Lojas para selects e filtros (ativas primeiro, depois por nome).
 * `cache` evita repetir a consulta na mesma requisição.
 */
export const listarLojasOpcoes = cache(async (): Promise<LojaOpcao[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lojas")
    .select("id, nome, ativo")
    .order("ativo", { ascending: false })
    .order("nome");

  if (error) {
    console.error("Erro ao listar lojas:", error);
    return [];
  }
  return data;
});
