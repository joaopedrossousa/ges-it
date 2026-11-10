import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type ColaboradorOpcao = {
  id: string;
  nome: string;
  email: string;
  loja_nome: string | null;
};

/** Usuários ativos para vincular/transferir (sem CPF). */
export const listarColaboradoresAtivos = cache(
  async (): Promise<ColaboradorOpcao[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("colaboradores")
      .select("id, nome, email, loja:lojas(nome)")
      .eq("ativo", true)
      .order("nome");

    if (error) {
      console.error("Erro ao listar colaboradores ativos:", error);
      return [];
    }
    return data.map((c) => ({
      id: c.id,
      nome: c.nome,
      email: c.email,
      loja_nome: c.loja?.nome ?? null,
    }));
  },
);
