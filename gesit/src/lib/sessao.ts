import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Claims do JWT do usuário logado, ou null sem sessão. Uma leitura por
 * requisição (React cache): o layout, as páginas e os blocos compartilham.
 *
 * getClaims() valida o JWT localmente (o projeto assina com chave
 * assimétrica ES256; a JWKS fica em memória por 10 min), sem ida ao Auth.
 * O proxy (src/lib/supabase/proxy.ts) já validou e renovou a sessão antes da
 * página; esta leitura serve para saber quem é o usuário.
 */
export const obterClaims = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
});

/** Id do usuário logado (claim sub), ou null. */
export const usuarioLogadoId = cache(async (): Promise<string | null> => {
  const claims = await obterClaims();
  return typeof claims?.sub === "string" ? claims.sub : null;
});
