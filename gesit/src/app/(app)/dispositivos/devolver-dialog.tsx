"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { executarAcao } from "@/lib/executar-acao";
import {
  STATUS_DISPOSITIVO_LABEL,
  STATUS_EDITAVEIS,
  ehStatusEditavel,
  type StatusEditavel,
} from "@/lib/types";

import { devolverDispositivo } from "./actions";

type Props = {
  dispositivo: { id: string; descricao: string };
  colaboradorNome: string;
  trigger: ReactNode;
};

export function DevolverDialog({ dispositivo, colaboradorNome, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [novoStatus, setNovoStatus] = useState<StatusEditavel>("disponivel");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    if (isPending) return;
    if (next) {
      setObservacao("");
      setNovoStatus("disponivel");
      setErro(null);
    }
    setOpen(next);
  }

  function salvar() {
    startTransition(async () => {
      const result = await executarAcao(() =>
        devolverDispositivo({
          dispositivo_id: dispositivo.id,
          observacao,
          novo_status: novoStatus,
        }),
      );
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      toast.success(`Devolução de ${colaboradorNome} registrada.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar devolução</DialogTitle>
          <DialogDescription>
            {dispositivo.descricao} — encerra o vínculo com{" "}
            <strong>{colaboradorNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dev-status">Status após a devolução</Label>
            <Select
              value={novoStatus}
              onValueChange={(v) => {
                if (ehStatusEditavel(v)) setNovoStatus(v);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="dev-status" className="w-full">
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

          <div className="grid gap-2">
            <Label htmlFor="dev-obs">Observação da devolução (opcional)</Label>
            <Textarea
              id="dev-obs"
              rows={3}
              maxLength={1000}
              placeholder="Ex.: devolvido com carregador; tela com risco."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              disabled={isPending}
            />
          </div>

          {erro && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={isPending}>
            {isPending ? "Salvando..." : "Registrar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
