import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { ComentarioAtividade } from "@/lib/atividades";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/atividades/comentarios?atividade=<id>
 * Comentários não removidos da atividade, do mais antigo para o mais novo,
 * com as imagens não removidas. Leitura com a sessão do usuário (RLS).
 */
export async function GET(request: NextRequest) {
  const atividade = request.nextUrl.searchParams.get("atividade");
  if (!z.uuid().safeParse(atividade).success || !atividade) {
    return NextResponse.json({ erro: "Atividade inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kanban_comentarios")
    .select(
      "id, texto, autor_id, created_at, editado_em, anexos:kanban_comentario_anexos(id, nome_arquivo, created_at, removido)",
    )
    .eq("atividade_id", atividade)
    .eq("removido", false)
    .order("created_at")
    .order("id");

  if (error) {
    console.error("Erro ao listar comentários:", error);
    return NextResponse.json({ erro: "Não foi possível carregar os comentários." }, { status: 500 });
  }

  const comentarios: ComentarioAtividade[] = data.map(({ anexos, ...c }) => ({
    ...c,
    anexos: anexos
      .filter((a) => !a.removido)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .map((a) => ({ id: a.id, nome: a.nome_arquivo })),
  }));

  return NextResponse.json({ comentarios }, { headers: { "Cache-Control": "no-store" } });
}
