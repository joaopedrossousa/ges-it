"use client";

import {
  ChevronRightIcon,
  LaptopIcon,
  MonitorIcon,
  SmartphoneIcon,
  UserCheckIcon,
  UserXIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Carregando } from "@/components/carregando";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { executarAcao } from "@/lib/executar-acao";
import { TIPO_DISPOSITIVO_LABEL } from "@/lib/types";

import { alterarStatusColaborador, type DispositivoPendente } from "./actions";

type Props = {
  id: string;
  nome: string;
  ativo: boolean;
  size?: "sm" | "default";
};

/** Inativar/Reativar — substitui a exclusão de usuários. */
export function StatusButton({ id, nome, ativo, size = "sm" }: Props) {
  const [isPending, startTransition] = useTransition();
  const [bloqueio, setBloqueio] = useState<{
    mensagem: string;
    dispositivos: DispositivoPendente[];
  } | null>(null);

  function alternar() {
    startTransition(async () => {
      const result = await executarAcao(() => alterarStatusColaborador(id, !ativo));
      if (!result.ok) {
        if (result.dispositivosPendentes?.length) {
          setBloqueio({
            mensagem: result.error,
            dispositivos: result.dispositivosPendentes,
          });
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success(ativo ? `${nome} foi inativado.` : `${nome} foi reativado.`);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={ativo ? "ghost" : "outline"}
        size={size}
        onClick={alternar}
        disabled={isPending}
      >
        {isPending ? <Carregando decorativo tamanho="sm" /> : ativo ? <UserXIcon /> : <UserCheckIcon />}
        {isPending ? "Salvando..." : ativo ? "Inativar" : "Reativar"}
        {!isPending && <span className="sr-only"> {nome}</span>}
      </Button>

      <Dialog open={bloqueio !== null} onOpenChange={(o) => !o && setBloqueio(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Não é possível inativar {nome}</DialogTitle>
            <DialogDescription>{bloqueio?.mensagem}</DialogDescription>
          </DialogHeader>

          <ul className="divide-y rounded-lg border">
            {bloqueio?.dispositivos.map((d) => {
              const Icone =
                d.tipo === "telefone"
                  ? SmartphoneIcon
                  : d.tipo === "monitor"
                    ? MonitorIcon
                    : LaptopIcon;
              return (
                <li key={d.id}>
                  <Link
                    href={`/dispositivos/${d.id}`}
                    onClick={() => setBloqueio(null)}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <Icone className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {TIPO_DISPOSITIVO_LABEL[d.tipo]} · {d.marca} {d.modelo}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {d.identificacao}
                      </span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Fechar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
