import type { PostgrestError } from "@supabase/supabase-js";
import type { ZodError } from "zod";

/** Retorno padrão das Server Actions de formulário. */
export type ActionResult<Campo extends string = string> =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<Campo, string>>;
    };

/** Primeira mensagem de erro do zod por campo (nível superior). */
export function errosDoZod<Campo extends string>(
  error: ZodError,
): ActionResult<Campo> {
  const fieldErrors: Partial<Record<Campo, string>> = {};
  for (const issue of error.issues) {
    const campo = issue.path[0];
    if (typeof campo === "string" && !(campo in fieldErrors)) {
      fieldErrors[campo as Campo] = issue.message;
    }
  }
  return { ok: false, error: "Verifique os campos destacados.", fieldErrors };
}

type RegraDuplicidade<Campo extends string> = {
  /** Coluna com restrição unique no banco. */
  coluna: string;
  /** Campo do formulário onde a mensagem aparece. */
  campo: Campo;
  mensagem: string;
};

/**
 * Traduz erros do Postgres/PostgREST para mensagens em português.
 * Para 23505 (unique_violation), identifica a coluna pelo `details`
 * ("Key (cpf)=(...) already exists.") ou pelo nome da constraint.
 */
export function erroDoBanco<Campo extends string>(
  error: PostgrestError,
  duplicidades: RegraDuplicidade<Campo>[] = [],
): ActionResult<Campo> {
  if (error.code === "23505") {
    const coluna =
      error.details?.match(/Key \((\w+)\)=/)?.[1] ??
      duplicidades.find((d) => error.message.includes(`_${d.coluna}_key`))
        ?.coluna;
    const regra = duplicidades.find((d) => d.coluna === coluna);
    if (regra) {
      return {
        ok: false,
        error: regra.mensagem,
        fieldErrors: { [regra.campo]: regra.mensagem } as Partial<
          Record<Campo, string>
        >,
      };
    }
    return { ok: false, error: "Registro já cadastrado." };
  }

  const mensagens: Record<string, string> = {
    "42501": "Você não tem permissão para esta operação.",
    "23503": "Registro relacionado não encontrado. Atualize a página.",
    "23514": "Dados inválidos. Verifique os campos.",
    PGRST116: "Registro não encontrado.",
  };
  if (error.code && mensagens[error.code]) {
    return { ok: false, error: mensagens[error.code] };
  }

  console.error("Erro do banco:", error);
  return { ok: false, error: "Não foi possível salvar. Tente novamente." };
}
