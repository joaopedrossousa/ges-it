"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Carregando } from "@/components/carregando";
import { MensagemErro } from "@/components/mensagem-erro";
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
import { executarAcao } from "@/lib/executar-acao";
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
    cargo: string | null;
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
    cargo: colaborador?.cargo ?? "",
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
      const result = await executarAcao(() =>
        colaborador
          ? atualizarColaborador(colaborador.id, values)
          : criarColaborador(values),
      );

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
      <DialogContent className="sm:max-w-lg">
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
              aria-required
              aria-invalid={Boolean(errors.nome)}
              aria-describedby={errors.nome ? "colab-nome-erro" : undefined}
              disabled={isPending}
              {...register("nome")}
            />
            <MensagemErro id="colab-nome-erro" mensagem={errors.nome?.message} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="colab-cargo">Cargo (opcional)</Label>
            <Input
              id="colab-cargo"
              autoComplete="off"
              maxLength={100}
              aria-invalid={Boolean(errors.cargo)}
              aria-describedby={errors.cargo ? "colab-cargo-erro" : undefined}
              disabled={isPending}
              {...register("cargo")}
            />
            <MensagemErro id="colab-cargo-erro" mensagem={errors.cargo?.message} />
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
                    // ref: o react-hook-form foca o campo com erro ao enviar.
                    ref={field.ref}
                    id="colab-loja"
                    className="w-full"
                    aria-required
                    aria-invalid={Boolean(errors.loja_id)}
                    aria-describedby={errors.loja_id ? "colab-loja-erro" : undefined}
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
            <MensagemErro id="colab-loja-erro" mensagem={errors.loja_id?.message} />
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
                  aria-required
                  aria-invalid={Boolean(errors.cpf)}
                  aria-describedby={errors.cpf ? "colab-cpf-erro" : undefined}
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
            <MensagemErro id="colab-cpf-erro" mensagem={errors.cpf?.message} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="colab-email">E-mail corporativo</Label>
            <Input
              id="colab-email"
              type="email"
              autoComplete="off"
              aria-required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "colab-email-erro" : undefined}
              disabled={isPending}
              {...register("email")}
            />
            <MensagemErro id="colab-email-erro" mensagem={errors.email?.message} />
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
              {isPending && <Carregando decorativo tamanho="sm" />}
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
