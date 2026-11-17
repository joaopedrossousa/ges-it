"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ColunaQuadro } from "@/lib/atividades";
import { executarAcao } from "@/lib/executar-acao";
import type { CorKanban } from "@/lib/types";
import { colunaKanbanSchema } from "@/lib/validators";

import { atualizarColuna, criarColuna } from "./actions";

/** Criar (sem `coluna`) ou renomear/trocar a cor. Aberto pelo pai. */
export function ColunaFormDialog({
  coluna,
  open,
  onOpenChange,
}: {
  coluna?: ColunaQuadro;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{coluna ? "Editar Coluna" : "Nova Coluna"}</DialogTitle>
          <DialogDescription>
            {coluna
              ? "Renomeie a coluna ou troque a cor."
              : "A coluna nova entra no fim do quadro. Arraste para mudar a ordem."}
          </DialogDescription>
        </DialogHeader>
        {/* Só existe com o diálogo aberto: reabrir começa do zero. */}
        {open && <FormColuna coluna={coluna} onFechar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function FormColuna({ coluna, onFechar }: { coluna?: ColunaQuadro; onFechar: () => void }) {
  const [nome, setNome] = useState(coluna?.nome ?? "");
  const [cor, setCor] = useState<CorKanban>(coluna?.cor ?? "cinza");
  const [erroNome, setErroNome] = useState<string>();
  const [erro, setErro] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function salvar(e: FormEvent) {
    e.preventDefault();
    const parsed = colunaKanbanSchema.safeParse({ nome, cor });
    if (!parsed.success) {
      setErroNome(parsed.error.issues.find((i) => i.path[0] === "nome")?.message);
      return;
    }
    setErroNome(undefined);
    startTransition(async () => {
      const r = await executarAcao(() =>
        coluna ? atualizarColuna(coluna.id, parsed.data) : criarColuna(parsed.data),
      );
      if (!r.ok) {
        if (r.fieldErrors?.nome) setErroNome(r.fieldErrors.nome);
        else setErro(r.error);
        return;
      }
      toast.success(coluna ? "Coluna atualizada." : "Coluna criada.");
      onFechar();
    });
  }

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="coluna-nome">Nome</Label>
        <Input
          id="coluna-nome"
          autoComplete="off"
          maxLength={60}
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-required
          aria-invalid={Boolean(erroNome)}
          aria-describedby={erroNome ? "coluna-nome-erro" : undefined}
          disabled={isPending}
        />
        <MensagemErro id="coluna-nome-erro" mensagem={erroNome} />
      </div>

      <div className="grid gap-2">
        <span id="coluna-cor-rotulo" className="text-sm font-medium">
          Cor
        </span>
        <SeletorCor value={cor} onChange={setCor} idRotulo="coluna-cor-rotulo" disabled={isPending} previa={nome} />
      </div>

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

/** Botão "Nova coluna" do topo da página. */
export function NovaColunaBotao() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Nova coluna
      </Button>
      <ColunaFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
