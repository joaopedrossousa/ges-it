import { NextResponse } from "next/server";

import { REGEX_CAMINHO_ANEXO, type BucketAnexo } from "@/lib/anexos";
import { createClient } from "@/lib/supabase/server";

/** Validade do link assinado, em segundos. */
const VALIDADE = 60;

/**
 * Gera, a cada clique, uma URL assinada de 60 s para um anexo de bucket
 * privado e redireciona para ela. O proxy já exige login; as policies de
 * select do Storage só liberam usuários autenticados.
 */
export async function redirecionarParaAnexo(bucket: BucketAnexo, path: string) {
  if (!REGEX_CAMINHO_ANEXO.test(path)) {
    return new NextResponse("Arquivo inválido.", { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, VALIDADE);

  if (error || !data?.signedUrl) {
    return new NextResponse("Arquivo não encontrado.", { status: 404 });
  }

  const resposta = NextResponse.redirect(data.signedUrl);
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}
