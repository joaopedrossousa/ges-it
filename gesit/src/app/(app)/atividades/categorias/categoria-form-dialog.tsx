"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Etiqueta } from "@/components/atividades/etiquetas";
import { SeletorCor } from "@/components/atividades/seletor-cor";
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
import { Switch } from "@/components/ui/switch";
import type { CategoriaKanban } from "@/lib/atividades";
import { executarAcao } from "@/lib/executar-acao";
import type { CorKanban } from "@/lib/types";
import { categoriaKanbanSchema } from "@/lib/validators";

import { atualizarCategoria, criarCategoria } from "../actions";

/** Criar (sem `categoria`) ou editar: nome, cor e ativa. */
export function CategoriaFormDialog({
  categoria,
  trigger,
}: {
  categoria?: CategoriaKanban;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          <DialogDescription>
            Etiqueta colorida das atividades. Inativa não aparece para novas atividades, mas
            continua nas que já a têm.
          </DialogDescription>
        </DialogHeader>
        {open && <FormCategoria categoria={categoria} onFechar={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function FormCategoria({ categoria, onFechar }: { categoria?: CategoriaKanban; onFechar: () => void }) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [cor, setCor] = useState<CorKanban>(categoria?.cor ?? "cinza");
  const [ativa, setAtiva] = useState(categoria?.ativa ?? true);
  const [erroNome, setErroNome] = useState<string>();
  const [erro, setErro] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function salvar(e: FormEvent) {
    e.preventDefault();
    const parsed = categoriaKanbanSchema.safeParse({ nome, cor, ativa });
    if (!parsed.success) {
      setErroNome(parsed.error.issues.find((i) => i.path[0] === "nome")?.message);
      return;
    }
    setErroNome(undefined);
    startTransition(async () => {
      const r = await executarAcao(() =>
        categoria ? atualizarCategoria(categoria.id, parsed.data) : criarCategoria(parsed.data),
      );
      if (!r.ok) {
        if (r.fieldErrors?.nome) setErroNome(r.fieldErrors.nome);
        else setErro(r.error);
        return;
      }
      toast.success(categoria ? "Categoria atualizada." : "Categoria criada.");
      onFechar();
    });
  }

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="categoria-nome">Nome</Label>
        <Input
          id="categoria-nome"
          autoComplete="off"
          maxLength={40}
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-required
          aria-invalid={Boolean(erroNome)}
          aria-describedby={erroNome ? "categoria-nome-erro" : undefined}
          disabled={isPending}
        />
        <MensagemErro id="categoria-nome-erro" mensagem={erroNome} />
      </div>

      <div className="grid gap-2">
        <span id="categoria-cor-rotulo" className="text-sm font-medium">
          Cor
        </span>
        <SeletorCor value={cor} onChange={setCor} idRotulo="categoria-cor-rotulo" disabled={isPending} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Prévia: <Etiqueta cor={cor}>{nome.trim() || "Categoria"}</Etiqueta>
        </div>
      </div>

      {categoria && (
        <div className="flex items-center gap-3">
          <Switch id="categoria-ativa" checked={ativa} onCheckedChange={setAtiva} disabled={isPending} />
          <Label htmlFor="categoria-ativa">Ativa</Label>
        </div>
      )}

      {erro && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFechar} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Carregando decorativo tamanho="sm" />}
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
