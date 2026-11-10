"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { loginSchema, type LoginInput } from "./schema";

export type LoginResult = { error: string };

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  user_not_found: "E-mail ou senha incorretos.",
  email_not_confirmed: "E-mail ainda não confirmado. Fale com o administrador.",
  user_banned: "Acesso bloqueado. Fale com o administrador.",
  over_request_rate_limit:
    "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
  validation_failed: "Verifique o e-mail e a senha informados.",
  email_address_invalid: "Informe um e-mail válido.",
  request_timeout: "O servidor demorou para responder. Tente novamente.",
};

/** Aceita apenas caminhos internos, para evitar redirecionamento aberto. */
function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  if (/^\/login(?:[/?#]|$)/.test(next)) return "/";
  return next;
}

export async function login(
  values: LoginInput,
  next?: string | null,
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Dados de login inválidos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    const message =
      (error.code && AUTH_ERRORS[error.code]) ||
      (error.status === 400
        ? "E-mail ou senha incorretos."
        : "Não foi possível entrar agora. Tente novamente em instantes.");
    return { error: message };
  }

  redirect(safeNext(next));
}
