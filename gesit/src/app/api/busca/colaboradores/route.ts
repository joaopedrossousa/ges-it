import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { LIMITE_BUSCA, MINIMO_BUSCA, limparBusca, palavrasBusca } from "@/lib/busca";
import type { ColaboradorOpcao } from "@/lib/opcoes-vinculo";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/busca/colaboradores?q=<texto>&excluir=<uuid>
 * Combobox do diálogo de vincular: só colaboradores ativos, sem CPF.
 * Cada palavra precisa casar com nome ou e-mail. `excluir` tira o usuário
 * atual do dispositivo (não pode receber o mesmo dispositivo).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const excluir = request.nextUrl.searchParams.get("excluir");
  const palavras = palavrasBusca(q);
  if (limparBusca(q).length < MINIMO_BUSCA || palavras.length === 0) {
    return resposta([]);
  }

  const supabase = await createClient();
  let query = supabase
    .from("colaboradores")
    .select("id, nome, email, loja:lojas(nome)")
    .eq("ativo", true);

  for (const p of palavras) {
    query = query.or(`nome.ilike.%${p}%,email.ilike.%${p}%`);
  }
  if (excluir && z.uuid().safeParse(excluir).success) {
    query = query.neq("id", excluir);
  }

  const { data, error } = await query.order("nome").order("id").limit(LIMITE_BUSCA);

  if (error) {
    console.error("Erro na busca de colaboradores:", error);
    return NextResponse.json({ erro: "Não foi possível buscar." }, { status: 500 });
  }

  return resposta(
    data.map((c) => ({
      id: c.id,
      nome: c.nome,
      email: c.email,
      loja_nome: c.loja?.nome ?? null,
    })),
  );
}

function resposta(itens: ColaboradorOpcao[]) {
  return NextResponse.json({ itens }, { headers: { "Cache-Control": "no-store" } });
}
