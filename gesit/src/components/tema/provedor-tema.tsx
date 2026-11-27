"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/** Chave do localStorage com a escolha do usuário (claro, escuro ou system). */
export const CHAVE_TEMA = "gesit-tema";

/**
 * Tema claro/escuro: põe a classe .dark no <html> (tokens em globals.css).
 * O padrão segue o sistema operacional; a escolha fica no localStorage. O
 * script do next-themes roda antes da pintura, então não há flash de tema
 * errado (o <html> tem suppressHydrationWarning por causa da classe).
 */
export function ProvedorTema({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={CHAVE_TEMA}
    >
      {children}
    </ThemeProvider>
  );
}
