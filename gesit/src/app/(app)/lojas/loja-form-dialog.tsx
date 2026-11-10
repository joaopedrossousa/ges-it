"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LojaRow } from "@/lib/types";
import {
  lojaSchema,
  type LojaFormData,
  type LojaFormInput,
} from "@/lib/validators";

import { atualizarLoja, criarLoja } from "./actions";

type Props = {
  loja?: Pick<LojaRow, "id" | "nome" | "cidade" | "ativo">;
  trigger: ReactNode;
};

export function LojaFormDialog({ loja, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const editando = Boolean(loja);

  const valoresIniciais: LojaFormInput = {
    nome: loja?.nome ?? "",
    cidade: loja?.cidade ?? "",
    ativo: loja?.ativo ?? true,
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<LojaFormInput, unknown, LojaFormData>({
    resolver: zodResolver(lojaSchema),
    defaultValues: valoresIniciais,
  });

  function onOpenChange(next: boolean) {
    if (next) reset(valoresIniciais);
    setOpen(next);
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = loja
        ? await atualizarLoja(loja.id, values)
        : await criarLoja(values);

      if (!result.ok) {
        for (const [campo, mensagem] of Object.entries(result.fieldErrors ?? {})) {
          setError(campo as keyof LojaFormInput, { message: mensagem });
        }
        if (!result.fieldErrors) setError("root", { message: result.error });
        return;
      }

      toast.success(editando ? "Loja atualizada." : "Loja cadastrada.");
      setOpen(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar loja" : "Nova loja"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Altere os dados da loja/filial."
                : "Cadastre uma nova loja ou filial."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="loja-nome">Nome</Label>
            <Input
              id="loja-nome"
              autoFocus
              aria-invalid={Boolean(errors.nome)}
              disabled={isPending}
              {...register("nome")}
            />
            {errors.nome && (
              <p className="text-sm text-destructive">{errors.nome.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="loja-cidade">Cidade</Label>
            <Input
              id="loja-cidade"
              aria-invalid={Boolean(errors.cidade)}
              disabled={isPending}
              {...register("cidade")}
            />
            {errors.cidade && (
              <p className="text-sm text-destructive">{errors.cidade.message}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="ativo"
              render={({ field }) => (
                <Switch
                  id="loja-ativo"
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
            <Label htmlFor="loja-ativo">Ativa</Label>
          </div>

          {errors.root && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errors.root.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
