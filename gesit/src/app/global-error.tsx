"use client";

import { useEffect } from "react";

import "./globals.css";

/** Erro no layout raiz: substitui o documento inteiro, por isso inclui <html>. */
export default function ErroGlobal({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-svh items-center justify-center p-4">
        <div role="alert" className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Algo deu errado</h1>
          <p className="text-muted-foreground">
            O GesIT encontrou um erro inesperado. Tente novamente; se o problema
            continuar, avise a equipe de T.I.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
