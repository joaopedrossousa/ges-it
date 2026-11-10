import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Validade do link assinado, em segundos. */
const VALIDADE = 60;

/**
 * GET /api/termos?path=<caminho no bucket>
 * Gera, a cada clique, uma URL assinada de 60 s para o PDF no bucket privado
 * "termos" e redireciona para ela. O proxy já exige login; a política do
 * Storage (termos_select) só libera usuários autenticados.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";

  if (
    !path ||
    path.length > 300 ||
    path.startsWith("/") ||
    path.includes("..") ||
    !path.toLowerCase().endsWith(".pdf")
  ) {
    return new NextResponse("Termo inválido.", { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("termos")
    .createSignedUrl(path, VALIDADE);

  if (error || !data?.signedUrl) {
    return new NextResponse("Termo não encontrado.", { status: 404 });
  }

  const resposta = NextResponse.redirect(data.signedUrl);
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
