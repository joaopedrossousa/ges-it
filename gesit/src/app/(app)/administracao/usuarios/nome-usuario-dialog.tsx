"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { executarAcao } from "@/lib/executar-acao";
import { nomeExibicaoSchema, type NomeExibicaoInput } from "@/lib/validators";

import { definirNomeUsuario } from "./actions";

type Props = {
  usuario: {
    id: string;
    email: string;
    /** Nome cadastrado no GesIT, se houver. */
    nomeExibicao: string | null;
    /** Nome do cadastro do Supabase (sugestão quando não há nome no GesIT). */
    nomeSupabase: string | null;
  };
};

/** Editar o nome de exibição (obrigatório; iniciais maiúsculas ao salvar). */
export function NomeUsuarioDialog({ usuario }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inicial: NomeExibicaoInput = { nome: usuario.nomeExibicao ?? usuario.nomeSupabase ?? "" };

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NomeExibicaoInput, unknown, { nome: string }>({
    resolver: zodResolver(nomeExibicaoSchema),
    defaultValues: inicial,
  });

  function onOpenChange(next: boolean) {
    if (isPending) return;
    if (next) reset(inicial);
    setOpen(next);
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const r = await executarAcao(() => definirNomeUsuario(usuario.id, values));
      if (!r.ok) {
        const mensagem = r.fieldErrors?.nome;
        if (mensagem) setError("nome", { message: mensagem });
        else setError("root", { message: r.error });
        return;
      }
      toast.success(`Nome salvo: ${values.nome}.`);
      setOpen(false);
    });
  });

  const erro = errors.nome?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <PencilIcon />
          Editar<span className="sr-only"> o nome de {usuario.email}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nome de Exibição</DialogTitle>
          <DialogDescription className="break-all">{usuario.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="usuario-nome">Nome de exibição</Label>
            <Input
              id="usuario-nome"
              autoComplete="off"
              autoFocus
              maxLength={100}
              placeholder="Ex.: João Pedro Sousa"
              aria-required
              aria-invalid={Boolean(erro)}
              aria-describedby={erro ? "usuario-nome-erro usuario-nome-ajuda" : "usuario-nome-ajuda"}
              disabled={isPending}
              {...register("nome")}
            />
            <p id="usuario-nome-ajuda" className="text-xs text-muted-foreground">
              Aparece no lugar do e-mail no quadro, nos comentários, na auditoria e nos avisos do
              Telegram. As iniciais ficam maiúsculas ao salvar.
            </p>
            <MensagemErro id="usuario-nome-erro" mensagem={erro} />
          </div>
          {errors.root?.message && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
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
