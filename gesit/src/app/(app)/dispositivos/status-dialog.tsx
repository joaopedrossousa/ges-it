"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Carregando } from "@/components/carregando";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { executarAcao } from "@/lib/executar-acao";
import {
  STATUS_DISPOSITIVO_LABEL,
  STATUS_EDITAVEIS,
  ehStatusEditavel,
  type StatusDispositivo,
} from "@/lib/types";

import { alterarStatusDispositivo } from "./actions";

type Props = {
  dispositivo: {
    id: string;
    descricao: string;
    status: StatusDispositivo;
    /** Preenchido quando há vínculo aberto. */
    colaboradorNome: string | null;
  };
  trigger: ReactNode;
};

export function StatusDialog({ dispositivo, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState<StatusDispositivo>(dispositivo.status);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const vinculado =
    Boolean(dispositivo.colaboradorNome) || dispositivo.status === "em_uso";

  function onOpenChange(next: boolean) {
    if (isPending) return;
    if (next) {
      setNovo(dispositivo.status);
      setErro(null);
    }
    setOpen(next);
  }

  function salvar() {
    if (!ehStatusEditavel(novo)) return;
    const escolhido = novo;
    startTransition(async () => {
      const result = await executarAcao(() =>
        alterarStatusDispositivo(dispositivo.id, escolhido),
      );
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      toast.success(`Status alterado para "${STATUS_DISPOSITIVO_LABEL[escolhido]}".`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar status</DialogTitle>
          <DialogDescription>{dispositivo.descricao}</DialogDescription>
        </DialogHeader>

        {vinculado ? (
          <p
            role="alert"
            className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-400"
          >
            Este dispositivo está vinculado a{" "}
            <strong>{dispositivo.colaboradorNome ?? "um usuário"}</strong>. Faça a
            devolução antes de alterar o status.
          </p>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="disp-status">Novo status</Label>
            <Select
              value={novo}
              onValueChange={(v) => {
                if (ehStatusEditavel(v)) setNovo(v);
              }}
              disabled={isPending}
            >
              <SelectTrigger
                id="disp-status"
                className="w-full"
                aria-describedby={erro ? "disp-status-erro" : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_EDITAVEIS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_DISPOSITIVO_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {erro && (
          <p
            id="disp-status-erro"
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {erro}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {vinculado ? "Fechar" : "Cancelar"}
          </Button>
          {!vinculado && (
            <Button
              type="button"
              onClick={salvar}
              disabled={isPending || novo === dispositivo.status}
            >
              {isPending && <Carregando decorativo tamanho="sm" />}
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
