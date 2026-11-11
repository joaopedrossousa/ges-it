import { NextResponse, type NextRequest } from "next/server";

import { REGEX_CAMINHO_NOTA_FISCAL } from "@/lib/notas-fiscais";
import { createClient } from "@/lib/supabase/server";

/** Validade do link assinado, em segundos. */
const VALIDADE = 60;

/**
 * GET /api/notas-fiscais?path=<caminho no bucket>
 * Gera, a cada clique, uma URL assinada de 60 s para a nota fiscal no bucket
 * privado "notas-fiscais" e redireciona para ela. O proxy já exige login; a
 * política do Storage (notas_fiscais_select) só libera usuários autenticados.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";

  if (!REGEX_CAMINHO_NOTA_FISCAL.test(path)) {
    return new NextResponse("Nota fiscal inválida.", { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("notas-fiscais")
    .createSignedUrl(path, VALIDADE);

  if (error || !data?.signedUrl) {
    return new NextResponse("Nota fiscal não encontrada.", { status: 404 });
  }

  const resposta = NextResponse.redirect(data.signedUrl);
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
