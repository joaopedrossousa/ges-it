import type { NextRequest } from "next/server";

import { redirecionarParaAnexo } from "@/lib/anexos-servidor";

/**
 * GET /api/financeiro/anexo?path=<caminho no bucket>
 * Redireciona para uma URL assinada de 60 s do boleto/NF do lançamento
 * (bucket privado "financeiro"), gerada no momento do clique.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  return redirecionarParaAnexo("financeiro", path);
}
