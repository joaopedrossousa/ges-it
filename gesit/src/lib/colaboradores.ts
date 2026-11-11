/** CPF e e-mail são opcionais (migration 013); faltar um deles = dados pendentes. */
type ComContato = { cpf: string | null; email: string | null };

/** "Sem CPF", "Sem e-mail" ou "Sem CPF e sem e-mail"; "" se completo. */
export function descreverPendencias(c: ComContato): string {
  const partes = [!c.cpf && "CPF", !c.email && "e-mail"].filter(Boolean);
  return partes.length ? `Sem ${partes.join(" e sem ")}` : "";
}

/** Filtro do PostgREST (dentro de .or) para quem tem dados pendentes. */
export const FILTRO_DADOS_PENDENTES = "cpf.is.null,email.is.null";
