"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Carregando } from "@/components/carregando";
import { CampoFilial } from "@/components/financeiro/campo-filial";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { executarAcao } from "@/lib/executar-acao";
import { TIPO_DESPESA_LABEL, ehTipoDespesa } from "@/lib/financeiro";
import type { LojaOpcao } from "@/lib/lojas";
import { TIPOS_DESPESA, type TipoDespesa } from "@/lib/types";
import {
  servicoFinanceiroSchema,
  valorParaCampo,
  type ServicoFinanceiroFormData,
  type ServicoFinanceiroFormInput,
} from "@/lib/validators";

import { atualizarServicoFinanceiro, criarServicoFinanceiro } from "../actions";

export type ServicoFinanceiroEditavel = {
  id: string;
  tipo: TipoDespesa;
  descricao: string;
  fornecedor: string | null;
  identificador: string | null;
  loja_id: string | null;
  dia_vencimento: number | null;
  valor_referencia: number | null;
  ativo: boolean;
  observacao: string | null;
};

type Props = {
  lojas: LojaOpcao[];
  /** Ausente = novo serviço. */
  servico?: ServicoFinanceiroEditavel;
  trigger: ReactNode;
};

type Campo = keyof ServicoFinanceiroFormInput;

const CAMPOS: Campo[] = [
  "tipo",
  "descricao",
  "fornecedor",
  "identificador",
  "loja_id",
  "dia_vencimento",
  "valor_referencia",
  "ativo",
  "observacao",
];

export function ServicoFinanceiroFormDialog({ lojas, servico, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const editando = Boolean(servico);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>
            Despesa recorrente do catálogo. Ela não gera lançamentos sozinha: serve para
            preencher o lançamento do mês.
          </DialogDescription>
        </DialogHeader>
        {/* O formulário só existe com o diálogo aberto: reabrir começa do zero. */}
        <FormServico
          lojas={lojas}
          servico={servico}
          onSalvo={() => {
            toast.success(editando ? "Serviço atualizado." : "Serviço cadastrado.");
            setOpen(false);
          }}
          onCancelar={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormServico({
  lojas,
  servico,
  onSalvo,
  onCancelar,
}: {
  lojas: LojaOpcao[];
  servico?: ServicoFinanceiroEditavel;
  onSalvo: () => void;
  onCancelar: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ServicoFinanceiroFormInput, unknown, ServicoFinanceiroFormData>({
    resolver: zodResolver(servicoFinanceiroSchema),
    defaultValues: {
      tipo: servico?.tipo,
      descricao: servico?.descricao ?? "",
      fornecedor: servico?.fornecedor ?? "",
      identificador: servico?.identificador ?? "",
      loja_id: servico?.loja_id ?? "",
      dia_vencimento: servico?.dia_vencimento ? String(servico.dia_vencimento) : "",
      valor_referencia: valorParaCampo(servico?.valor_referencia),
      ativo: servico?.ativo ?? true,
      observacao: servico?.observacao ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await executarAcao(() =>
        servico ? atualizarServicoFinanceiro(servico.id, values) : criarServicoFinanceiro(values),
      );
      if (!result.ok) {
        let algum = false;
        for (const campo of CAMPOS) {
          const mensagem = result.fieldErrors?.[campo];
          if (mensagem) {
            setError(campo, { message: mensagem });
            algum = true;
          }
        }
        if (!algum) setError("root", { message: result.error });
        return;
      }
      onSalvo();
    });
  });

  const erro = (campo: Campo) => errors[campo]?.message;
  const descrito = (campo: string, mensagem?: string) =>
    mensagem ? `sf-${campo}-erro` : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sf-tipo">Tipo</Label>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(v) => {
                  if (ehTipoDespesa(v)) field.onChange(v);
                }}
                disabled={isPending}
              >
                <SelectTrigger
                  id="sf-tipo"
                  ref={field.ref}
                  className="w-full"
                  aria-required
                  aria-invalid={Boolean(erro("tipo"))}
                  aria-describedby={descrito("tipo", erro("tipo"))}
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DESPESA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_DESPESA_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <MensagemErro id="sf-tipo-erro" mensagem={erro("tipo")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sf-descricao">Descrição</Label>
          <Input
            id="sf-descricao"
            autoComplete="off"
            maxLength={150}
            placeholder="Ex.: IBL NET"
            aria-required
            aria-invalid={Boolean(erro("descricao"))}
            aria-describedby={descrito("descricao", erro("descricao"))}
            disabled={isPending}
            {...register("descricao")}
          />
          <MensagemErro id="sf-descricao-erro" mensagem={erro("descricao")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sf-fornecedor">Fornecedor (opcional)</Label>
          <Input
            id="sf-fornecedor"
            autoComplete="off"
            maxLength={150}
            aria-invalid={Boolean(erro("fornecedor"))}
            aria-describedby={descrito("fornecedor", erro("fornecedor"))}
            disabled={isPending}
            {...register("fornecedor")}
          />
          <MensagemErro id="sf-fornecedor-erro" mensagem={erro("fornecedor")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sf-identificador">Identificador (opcional)</Label>
          <Input
            id="sf-identificador"
            autoComplete="off"
            maxLength={100}
            placeholder="Nº do contrato, da linha ou da conta"
            aria-invalid={Boolean(erro("identificador"))}
            aria-describedby={descrito("identificador", erro("identificador"))}
            disabled={isPending}
            {...register("identificador")}
          />
          <MensagemErro id="sf-identificador-erro" mensagem={erro("identificador")} />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="sf-loja">Filial (opcional)</Label>
          <Controller
            control={control}
            name="loja_id"
            render={({ field }) => (
              <CampoFilial
                id="sf-loja"
                ref={field.ref}
                lojas={lojas}
                atual={servico?.loja_id ?? null}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={isPending}
                invalid={Boolean(erro("loja_id"))}
                descritoPor={descrito("loja", erro("loja_id"))}
              />
            )}
          />
          <MensagemErro id="sf-loja-erro" mensagem={erro("loja_id")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sf-dia">Dia de vencimento (opcional)</Label>
          <Input
            id="sf-dia"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            placeholder="1 a 31"
            aria-invalid={Boolean(erro("dia_vencimento"))}
            aria-describedby={
              erro("dia_vencimento") ? "sf-dia-erro sf-dia-ajuda" : "sf-dia-ajuda"
            }
            disabled={isPending}
            {...register("dia_vencimento")}
          />
          <p id="sf-dia-ajuda" className="text-xs text-muted-foreground">
            Em meses mais curtos, vira o último dia.
          </p>
          <MensagemErro id="sf-dia-erro" mensagem={erro("dia_vencimento")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sf-valor">Valor de referência em R$ (opcional)</Label>
          <Input
            id="sf-valor"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            aria-invalid={Boolean(erro("valor_referencia"))}
            aria-describedby={descrito("valor", erro("valor_referencia"))}
            disabled={isPending}
            {...register("valor_referencia")}
          />
          <MensagemErro id="sf-valor-erro" mensagem={erro("valor_referencia")} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sf-observacao">Observação (opcional)</Label>
        <Textarea
          id="sf-observacao"
          rows={2}
          maxLength={1000}
          aria-invalid={Boolean(erro("observacao"))}
          aria-describedby={descrito("observacao", erro("observacao"))}
          disabled={isPending}
          {...register("observacao")}
        />
        <MensagemErro id="sf-observacao-erro" mensagem={erro("observacao")} />
      </div>

      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name="ativo"
          render={({ field }) => (
            <Switch
              id="sf-ativo"
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
              disabled={isPending}
            />
          )}
        />
        <Label htmlFor="sf-ativo">Ativo</Label>
        <span className="text-xs text-muted-foreground">
          Inativos não aparecem no novo lançamento.
        </span>
      </div>

      {errors.root?.message && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errors.root.message}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={isPending}>
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
