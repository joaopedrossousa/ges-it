/**
 * Configuração pública do Supabase (URL + chave anon/publishable).
 * Acesso literal a process.env.NEXT_PUBLIC_* para o Next embutir os valores
 * no bundle do navegador.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Papel ("role") de uma chave no formato JWT antigo; null se não for JWT. */
function papelDaChaveJwt(valor: string): string | null {
  try {
    const payload = valor.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const role: unknown = JSON.parse(json).role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

/**
 * Valida e devolve a configuração. Falha cedo, com mensagem clara, se faltar
 * variável ou se alguém colocar a chave secreta (service_role) no NEXT_PUBLIC,
 * o que a exporia no navegador.
 */
export function configSupabase(): { url: string; chave: string } {
  if (!url || !chave) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local.",
    );
  }
  if (chave.startsWith("sb_secret_") || papelDaChaveJwt(chave) === "service_role") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY contém uma chave secreta (service_role). Use a chave anon/publishable.",
    );
  }
  return { url, chave };
}
