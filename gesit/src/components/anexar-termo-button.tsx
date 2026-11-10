"use client";

import { PaperclipIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { anexarTermo } from "@/app/(app)/dispositivos/actions";
import { Carregando } from "@/components/carregando";
import { Button } from "@/components/ui/button";
import { executarAcao } from "@/lib/executar-acao";
import { enviarTermo, validarArquivoTermo } from "@/lib/termos";

type Props = {
  vinculoId: string;
  dispositivoId: string;
  colaboradorId: string;
  size?: "xs" | "sm";
};

/**
 * Escolhe o PDF, envia para o Storage em
 * {dispositivo_id}/{timestamp}_{colaborador_id}.pdf e grava no vínculo
 * (a função SQL anexar_termo só aceita se termo_path estiver nulo).
 */
export function AnexarTermoButton({
  vinculoId,
  dispositivoId,
  colaboradorId,
  size = "xs",
}: Props) {
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
      const envio = await enviarTermo(dispositivoId, colaboradorId, arquivo);
      if ("erro" in envio) {
        setEtapa(null);
        toast.error(envio.erro);
        return;
      }

      setEtapa("salvando");
      const result = await executarAcao(() => anexarTermo(vinculoId, envio.path));
      setEtapa(null);
      if (!result.ok) {
        toast.error(result.error, {
          description: `O PDF enviado ficou órfão em termos/${envio.path} (não foi apagado).`,
          duration: 15000,
        });
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
        {etapa !== null ? (
          <Carregando decorativo tamanho="sm" />
        ) : (
          <PaperclipIcon />
        )}
        {etapa === "enviando"
          ? "Enviando..."
          : etapa === "salvando"
            ? "Salvando..."
            : "Anexar termo"}
      </Button>
    </>
  );
}
