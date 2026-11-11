import type { NextRequest } from "next/server";

import { redirecionarParaAnexo } from "@/lib/anexos-servidor";

/**
 * GET /api/notas-fiscais?path=<caminho no bucket>
 * Redireciona para uma URL assinada de 60 s da nota fiscal (bucket privado
 * "notas-fiscais"), gerada no momento do clique.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  return redirecionarParaAnexo("notas-fiscais", path);
}
