import { nomeCurtoUsuario } from "@/lib/atividades";
import { listarUsuariosSistema } from "@/lib/atividades-servidor";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Usuário do sistema para exibir: nome (cadastrado ou fallback) e e-mail para o tooltip. */
export type AutorExibicao = { nome: string; email: string | null };

/**
 * Nome de exibição de usuários do sistema por id (quem registrou, quem
 * alterou). Vem de usuarios_sistema (nome cadastrado em Administração >
 * Usuários, migration 027; senão o do Supabase; senão a parte do e-mail
 * antes do @ com iniciais maiúsculas). Quem não estiver na lista (ex.:
 * usuário excluído) é buscado por e-mail em emails_operadores.
 */
export async function nomesDeUsuarios(
  supabase: Supabase,
  ids: (string | null | undefined)[],
): Promise<Map<string, AutorExibicao>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const mapa = new Map<string, AutorExibicao>();
  if (unicos.length === 0) return mapa;

  const usuarios = await listarUsuariosSistema().catch(() => []);
  const porId = new Map(usuarios.map((u) => [u.id, u]));
  const faltando: string[] = [];
  for (const id of unicos) {
    const u = porId.get(id);
    if (u) mapa.set(id, { nome: nomeCurtoUsuario(u), email: u.email });
    else faltando.push(id);
  }

  if (faltando.length > 0) {
    const { data } = await supabase.rpc("emails_operadores", { p_ids: faltando });
    for (const r of data ?? []) {
      mapa.set(r.id, { nome: nomeCurtoUsuario({ id: r.id, email: r.email, nome: null }), email: r.email });
    }
  }
  return mapa;
}

/** "Nome" ou "Usuário removido" (texto de tela); o e-mail vai no title. */
export function nomeDoAutor(mapa: Map<string, AutorExibicao>, id: string | null | undefined) {
  if (!id) return null;
  return mapa.get(id) ?? { nome: "Usuário removido", email: null };
}
