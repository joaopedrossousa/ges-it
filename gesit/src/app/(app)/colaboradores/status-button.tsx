"use client";

import { UserCheckIcon, UserXIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { alterarStatusColaborador } from "./actions";

type Props = {
  id: string;
  nome: string;
  ativo: boolean;
  size?: "sm" | "default";
};

/** Inativar/Reativar — substitui a exclusão de usuários. */
export function StatusButton({ id, nome, ativo, size = "sm" }: Props) {
  const [isPending, startTransition] = useTransition();

  function alternar() {
    startTransition(async () => {
      const result = await alterarStatusColaborador(id, !ativo);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(ativo ? `${nome} foi inativado.` : `${nome} foi reativado.`);
    });
  }

  return (
    <Button
      type="button"
      variant={ativo ? "ghost" : "outline"}
      size={size}
      onClick={alternar}
      disabled={isPending}
    >
      {ativo ? <UserXIcon /> : <UserCheckIcon />}
      {isPending ? "Salvando..." : ativo ? "Inativar" : "Reativar"}
    </Button>
  );
}
