"use client";

import { PaperclipIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { anexarTermo } from "@/app/(app)/dispositivos/actions";
import { Button } from "@/components/ui/button";
import { enviarTermo, validarArquivoTermo } from "@/lib/termos";

type Props = {
  vinculoId: string;
  dispositivoId: string;
  size?: "xs" | "sm";
};

/** Escolhe o PDF, envia para o Storage e grava no vínculo (só se estiver sem termo). */
export function AnexarTermoButton({ vinculoId, dispositivoId, size = "xs" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<"enviando" | "salvando" | null>(null);
  const [, startTransition] = useTransition();

  function aoEscolher(arquivo: File | null) {
    if (inputRef.current) inputRef.current.value = "";
    if (!arquivo) return;

    const erro = validarArquivoTermo(arquivo);
    if (erro) {
      toast.error(erro);
      return;
    }

    startTransition(async () => {
      setEtapa("enviando");
      const envio = await enviarTermo(dispositivoId, arquivo);
      if ("erro" in envio) {
        setEtapa(null);
        toast.error(envio.erro);
        return;
      }

      setEtapa("salvando");
      const result = await anexarTermo(vinculoId, envio.path);
      setEtapa(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Termo anexado.");
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => aoEscolher(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={etapa !== null}
        onClick={() => inputRef.current?.click()}
      >
        <PaperclipIcon />
        {etapa === "enviando"
          ? "Enviando..."
          : etapa === "salvando"
            ? "Salvando..."
            : "Anexar termo"}
      </Button>
    </>
  );
}
