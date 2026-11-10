"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Erro inesperado em uma página autenticada (o menu lateral continua visível). */
export default function ErroDaPagina({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const codigo =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
    >
      <TriangleAlertIcon className="size-10 text-destructive" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="text-muted-foreground">
          Não foi possível carregar esta página. Tente novamente; se o problema
          continuar, avise a equipe de T.I.
        </p>
        {codigo && (
          <p className="text-xs text-muted-foreground">
            Código do erro: <code>{codigo}</code>
          </p>
        )}
      </div>
      <Button onClick={() => retry()}>
        <RotateCcwIcon />
        Tentar novamente
      </Button>
    </div>
  );
}
