import type { NextRequest } from "next/server";

import { redirecionarParaAnexo } from "@/lib/anexos-servidor";

/**
 * GET /api/servicos/anexo?path=<caminho no bucket>
 * Redireciona para uma URL assinada de 60 s do anexo do serviço (bucket
 * privado "servicos"), gerada no momento do clique.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  return redirecionarParaAnexo("servicos", path);
}
