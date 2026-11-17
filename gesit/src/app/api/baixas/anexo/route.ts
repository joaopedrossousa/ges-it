import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/** Validade do link assinado, em segundos. */
const VALIDADE = 60;

/**
 * GET /api/baixas/anexo?id=<id do anexo>
 * Busca o caminho em dispositivo_baixa_anexos (RLS: só autenticados) e
 * redireciona para uma URL assinada de 60 s do bucket privado "baixas",
 * gerada a cada clique (ou a cada carga da miniatura).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!z.uuid().safeParse(id).success || !id) {
    return new NextResponse("Anexo inválido.", { status: 400 });
  }

  const supabase = await createClient();
  const { data: anexo } = await supabase
    .from("dispositivo_baixa_anexos")
    .select("path")
    .eq("id", id)
    .maybeSingle();
  if (!anexo) return new NextResponse("Anexo não encontrado.", { status: 404 });

  const { data, error } = await supabase.storage
    .from("baixas")
    .createSignedUrl(anexo.path, VALIDADE);
  if (error || !data?.signedUrl) {
    return new NextResponse("Arquivo não encontrado.", { status: 404 });
  }

  const resposta = NextResponse.redirect(data.signedUrl);
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
