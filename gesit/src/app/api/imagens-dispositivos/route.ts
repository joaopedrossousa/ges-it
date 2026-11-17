import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/** Validade do link assinado, em segundos. */
const VALIDADE = 60;

/**
 * GET /api/imagens-dispositivos?id=<id da imagem>
 * Busca o caminho em dispositivo_imagens (RLS: só autenticados) e redireciona
 * para uma URL assinada de 60 s do bucket privado "imagens-dispositivos",
 * gerada a cada clique (ou a cada carga da miniatura). Imagem removida
 * continua acessível pelo link (o log a cita), mas não aparece nas galerias.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!z.uuid().safeParse(id).success || !id) {
    return new NextResponse("Imagem inválida.", { status: 400 });
  }

  const supabase = await createClient();
  const { data: imagem } = await supabase
    .from("dispositivo_imagens")
    .select("path")
    .eq("id", id)
    .maybeSingle();
  if (!imagem) return new NextResponse("Imagem não encontrada.", { status: 404 });

  const { data, error } = await supabase.storage
    .from("imagens-dispositivos")
    .createSignedUrl(imagem.path, VALIDADE);
  if (error || !data?.signedUrl) {
    return new NextResponse("Arquivo não encontrado.", { status: 404 });
  }

  const resposta = NextResponse.redirect(data.signedUrl);
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
