"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CampoData } from "@/components/campo-data";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { executarAcao } from "@/lib/executar-acao";
import { SITUACAO_PAGAMENTO_LABEL } from "@/lib/financeiro";
import { hojeEmPalmas } from "@/lib/format";
import { SITUACOES_PAGAMENTO, type SituacaoPagamento } from "@/lib/types";

import { alterarSituacaoLancamento } from "../actions";

/**
 * Mudança rápida de situação na linha. "Pago" abre um diálogo para a data
 * do pagamento (padrão: hoje em Palmas); as outras salvam direto.
 */
export function SituacaoMenu({
  lancamento,
}: {
  /** `nome`: fornecedor · descrição · identificador. */
  lancamento: { id: string; nome: string; situacao: SituacaoPagamento };
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogoPago, setDialogoPago] = useState(false);
  const [data, setData] = useState("");
  const [erro, setErro] = useState<string | undefined>();

  function salvar(situacao: SituacaoPagamento, dataPagamento?: string) {
    startTransition(async () => {
      const result = await executarAcao(() =>
        alterarSituacaoLancamento(lancamento.id, {
          situacao,
          data_pagamento: dataPagamento ?? null,
        }),
      );
      if (!result.ok) {
        const mensagem = result.fieldErrors?.data_pagamento ?? result.error;
        if (dialogoPago) setErro(mensagem);
        else toast.error(mensagem);
        return;
      }
      toast.success(result.mensagem ?? "Situação alterada.");
      setDialogoPago(false);
    });
  }

  function escolher(situacao: SituacaoPagamento) {
    if (situacao === "pago") {
      setData(hojeEmPalmas());
      setErro(undefined);
      setDialogoPago(true);
      return;
    }
    salvar(situacao);
  }

  return (
    <>
      {/* modal={false}: o diálogo de "Pago" abre logo depois de o menu fechar. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isPending}>
            {isPending && !dialogoPago ? (
              <Carregando decorativo tamanho="sm" />
            ) : (
              <ChevronDownIcon />
            )}
            Situação<span className="sr-only"> de {lancamento.nome}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Alterar Situação</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SITUACOES_PAGAMENTO.map((s) => (
            <DropdownMenuItem
              key={s}
              disabled={s === lancamento.situacao}
              onSelect={() => escolher(s)}
            >
              {s === lancamento.situacao ? <CheckIcon /> : <span className="size-4" aria-hidden />}
              {SITUACAO_PAGAMENTO_LABEL[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialogoPago}
        onOpenChange={(v) => {
          if (!isPending) setDialogoPago(v);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
                setErro("Informe a data do pagamento.");
                return;
              }
              salvar("pago", data);
            }}
          >
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>{lancamento.nome}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={`pago-${lancamento.id}`}>Data do pagamento</Label>
              <CampoData
                id={`pago-${lancamento.id}`}
                value={data}
                onChange={(v) => {
                  setData(v);
                  setErro(undefined);
                }}
                emitirInvalido
                max={hojeEmPalmas()}
                required
                invalid={Boolean(erro)}
                descritoPor={erro ? `pago-${lancamento.id}-erro` : undefined}
                disabled={isPending}
              />
              <MensagemErro id={`pago-${lancamento.id}-erro`} mensagem={erro} />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogoPago(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Carregando decorativo tamanho="sm" />}
                {isPending ? "Salvando..." : "Registrar pagamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
