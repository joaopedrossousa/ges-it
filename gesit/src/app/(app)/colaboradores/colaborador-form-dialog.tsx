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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  colaboradorSchema,
  formatarCPFDigitando,
  type ColaboradorFormData,
  type ColaboradorFormInput,
} from "@/lib/validators";

import { atualizarColaborador, criarColaborador } from "./actions";
import type { LojaOpcao } from "@/lib/lojas";

type Props = {
  lojas: LojaOpcao[];
  /** Ausente = cadastro. Na edição, o CPF vem completo (só tela de detalhe). */
  colaborador?: {
    id: string;
    nome: string;
    loja_id: string;
    cpf: string;
    email: string;
  };
  trigger: ReactNode;
};

export function ColaboradorFormDialog({ lojas, colaborador, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const editando = Boolean(colaborador);

  // Lojas inativas só aparecem se já forem a loja atual do usuário.
  const opcoes = lojas.filter(
    (l) => l.ativo || l.id === colaborador?.loja_id,
  );

  const valoresIniciais: ColaboradorFormInput = {
    nome: colaborador?.nome ?? "",
    loja_id: colaborador?.loja_id ?? "",
    cpf: colaborador ? formatarCPFDigitando(colaborador.cpf) : "",
    email: colaborador?.email ?? "",
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ColaboradorFormInput, unknown, ColaboradorFormData>({
    resolver: zodResolver(colaboradorSchema),
    defaultValues: valoresIniciais,
  });

  function onOpenChange(next: boolean) {
    if (next) reset(valoresIniciais);
    setOpen(next);
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = colaborador
        ? await atualizarColaborador(colaborador.id, values)
        : await criarColaborador(values);

      if (!result.ok) {
        for (const [campo, mensagem] of Object.entries(result.fieldErrors ?? {})) {
          setError(campo as keyof ColaboradorFormInput, { message: mensagem });
        }
        if (!result.fieldErrors) setError("root", { message: result.error });
        return;
      }

      toast.success(editando ? "Usuário atualizado." : "Usuário cadastrado.");
      setOpen(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Altere os dados do usuário."
                : "Cadastre um usuário para vincular dispositivos."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="colab-nome">Nome</Label>
            <Input
              id="colab-nome"
              autoFocus
              autoComplete="off"
              aria-invalid={Boolean(errors.nome)}
              disabled={isPending}
              {...register("nome")}
            />
            {errors.nome && (
              <p className="text-sm text-destructive">{errors.nome.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="colab-loja">Loja/Filial</Label>
            <Controller
              control={control}
              name="loja_id"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="colab-loja"
                    className="w-full"
                    aria-invalid={Boolean(errors.loja_id)}
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoes.map((loja) => (
                      <SelectItem key={loja.id} value={loja.id}>
                        {loja.nome}
                        {!loja.ativo && " (inativa)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.loja_id && (
              <p className="text-sm text-destructive">{errors.loja_id.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="colab-cpf">CPF</Label>
            <Controller
              control={control}
              name="cpf"
              render={({ field }) => (
                <Input
                  id="colab-cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  aria-invalid={Boolean(errors.cpf)}
                  disabled={isPending}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(e) =>
                    field.onChange(formatarCPFDigitando(e.target.value))
                  }
                />
              )}
            />
            {errors.cpf && (
              <p className="text-sm text-destructive">{errors.cpf.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="colab-email">E-mail corporativo</Label>
            <Input
              id="colab-email"
              type="email"
              autoComplete="off"
              aria-invalid={Boolean(errors.email)}
              disabled={isPending}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
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
