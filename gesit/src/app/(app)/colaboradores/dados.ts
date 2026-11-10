import { createClient } from "@/lib/supabase/server";

export type LojaOpcao = { id: string; nome: string; ativo: boolean };

/** Lojas para selects (ativas primeiro, depois por nome). */
export async function listarLojasOpcoes(): Promise<LojaOpcao[]> {
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
}
