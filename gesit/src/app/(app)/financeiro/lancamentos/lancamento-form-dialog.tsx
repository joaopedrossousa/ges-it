"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Path } from "react-hook-form";
import { toast } from "sonner";

import { CampoArquivo } from "@/components/campo-arquivo";
import { CampoData } from "@/components/campo-data";
import { Carregando } from "@/components/carregando";
import { ComboboxLista, type OpcaoLista } from "@/components/combobox-lista";
import { CampoFilial } from "@/components/financeiro/campo-filial";
import { LinkAnexoLancamento } from "@/components/link-anexo-lancamento";
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
import { Textarea } from "@/components/ui/textarea";
import { ANEXO_ACCEPT, enviarAnexo, validarArquivoAnexo } from "@/lib/anexos";
import { executarAcao } from "@/lib/executar-acao";
import {
  SITUACAO_PAGAMENTO_LABEL,
  TIPO_DESPESA_LABEL,
  competenciaDoMes,
  ehSituacaoPagamento,
  ehTipoDespesa,
  formatarMes,
  mesesAoRedor,
  nomeFinanceiro,
  vencimentoNoMes,
} from "@/lib/financeiro";
import type { ServicoFinanceiroOpcao } from "@/lib/financeiro-servidor";
import { formatarDataHora, hojeEmPalmas } from "@/lib/format";
import type { LojaOpcao } from "@/lib/lojas";
import {
  SITUACOES_PAGAMENTO,
  TIPOS_DESPESA,
  type SituacaoPagamento,
  type TipoDespesa,
} from "@/lib/types";
import {
  lancamentoSchema,
  valorParaCampo,
  type LancamentoFormData,
  type LancamentoFormInput,
} from "@/lib/validators";

import { anexarArquivoLancamento, atualizarLancamento, criarLancamento } from "../actions";

export type LancamentoEditavel = {
  id: string;
  competencia: string;
  servico_id: string | null;
  tipo: TipoDespesa;
  fornecedor: string;
  descricao: string | null;
  loja_id: string | null;
  vencimento: string;
  valor: number;
  situacao: SituacaoPagamento;
  data_pagamento: string | null;
  id_aprovacao: string | null;
  aprovacao_ok: boolean | null;
  observacao: string | null;
  anexo_path: string | null;
  /** Quem lançou (nome de exibição, Administração > Usuários) e quando. */
  lancado_por?: { nome: string; email: string | null } | null;
  lancado_em?: string | null;
};

type Props = {
  lojas: LojaOpcao[];
  servicos: ServicoFinanceiroOpcao[];
  /** "AAAA-MM-01": o mês aberto na tela (novo lançamento). */
  competenciaPadrao: string;
  /** Ausente = novo lançamento. */
  lancamento?: LancamentoEditavel;
  trigger: ReactNode;
};

/** Opção "Avulso" do campo Serviço (o ComboboxLista não tem opção vazia). */
const AVULSO = "avulso";
/** Aprovação não informada (o Select do Radix não aceita valor vazio). */
const NAO_INFORMADO = "nao_informado";

const CAMPOS = [
  "competencia",
  "servico_id",
  "tipo",
  "fornecedor",
  "descricao",
  "loja_id",
  "vencimento",
  "valor",
  "situacao",
  "data_pagamento",
  "id_aprovacao",
  "aprovacao_ok",
  "observacao",
] as const satisfies readonly Path<LancamentoFormInput>[];
type Campo = (typeof CAMPOS)[number];

export function LancamentoFormDialog({
  lojas,
  servicos,
  competenciaPadrao,
  lancamento,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const editando = Boolean(lancamento);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
          <DialogDescription>
            Escolha um serviço do catálogo para preencher os campos, ou Avulso para preencher
            à mão. Tudo continua editável.
            {lancamento?.lancado_por && (
              <span className="mt-1 block">
                Lançado por{" "}
                <span className="font-medium text-foreground" title={lancamento.lancado_por.email ?? undefined}>
                  {lancamento.lancado_por.nome}
                </span>
                {lancamento.lancado_em && ` em ${formatarDataHora(lancamento.lancado_em)}`}.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        {/* O formulário só existe com o diálogo aberto: reabrir começa do zero. */}
        <FormLancamento
          lojas={lojas}
          servicos={servicos}
          competenciaPadrao={competenciaPadrao}
          lancamento={lancamento}
          onSalvo={(aviso) => {
            toast.success(editando ? "Lançamento atualizado." : "Lançamento registrado.");
            if (aviso) {
              toast.warning("O anexo não foi salvo.", {
                description: `${aviso} Tente de novo pelo botão Editar do lançamento.`,
                duration: 15000,
              });
            }
            setOpen(false);
          }}
          onCancelar={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormLancamento({
  lojas,
  servicos,
  competenciaPadrao,
  lancamento,
  onSalvo,
  onCancelar,
}: Omit<Props, "trigger"> & {
  /** `aviso`: os dados foram salvos, mas o anexo não. */
  onSalvo: (aviso?: string) => void;
  onCancelar: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [etapa, setEtapa] = useState<"salvando" | "enviando">("salvando");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | undefined>();
  /** Aviso de lançamento do mesmo serviço no mês; o próximo envio confirma. */
  const [duplicado, setDuplicado] = useState<string | null>(null);
  /** Vencimento veio do dia do catálogo (e acompanha a competência). */
  const vencimentoAuto = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<LancamentoFormInput, unknown, LancamentoFormData>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      competencia: lancamento?.competencia ?? competenciaPadrao,
      servico_id: lancamento?.servico_id ?? "",
      tipo: lancamento?.tipo,
      fornecedor: lancamento?.fornecedor ?? "",
      descricao: lancamento?.descricao ?? "",
      loja_id: lancamento?.loja_id ?? "",
      vencimento: lancamento?.vencimento ?? "",
      valor: valorParaCampo(lancamento?.valor),
      situacao: lancamento?.situacao ?? "solicitado_compras",
      data_pagamento: lancamento?.data_pagamento ?? "",
      id_aprovacao: lancamento?.id_aprovacao ?? "",
      aprovacao_ok:
        lancamento?.aprovacao_ok === true
          ? "ok"
          : lancamento?.aprovacao_ok === false
            ? "nao_ok"
            : "",
      observacao: lancamento?.observacao ?? "",
    },
  });

  const servicosPorId = new Map(servicos.map((s) => [s.id, s]));
  const opcoesServico: OpcaoLista[] = [
    { value: AVULSO, label: "Avulso", descricao: "Sem serviço do catálogo (ex.: compras)" },
    ...servicos
      .filter((s) => s.ativo || s.id === lancamento?.servico_id)
      .map((s) => {
        const loja = s.loja_id ? lojas.find((l) => l.id === s.loja_id)?.nome : undefined;
        return {
          value: s.id,
          label: s.ativo ? nomeFinanceiro(s) : `${nomeFinanceiro(s)} (inativo)`,
          descricao: [TIPO_DESPESA_LABEL[s.tipo], loja].filter(Boolean).join(" · "),
          termos: s.identificador ?? undefined,
        };
      }),
  ];

  const competencia = useWatch({ control, name: "competencia" });
  const mesesOpcoes = mesesAoRedor(competencia.slice(0, 7));
  const situacao = useWatch({ control, name: "situacao" });

  const opcoes = { shouldValidate: false, shouldDirty: true } as const;

  function escolherServico(id: string) {
    setDuplicado(null);
    if (id === AVULSO) {
      setValue("servico_id", "", opcoes);
      vencimentoAuto.current = false;
      return;
    }
    const s = servicosPorId.get(id);
    if (!s) return;
    setValue("servico_id", s.id, opcoes);
    setValue("tipo", s.tipo, opcoes);
    setValue("fornecedor", s.fornecedor, opcoes);
    setValue("descricao", s.descricao ?? "", opcoes);
    setValue("loja_id", s.loja_id ?? "", opcoes);
    if (s.valor_referencia !== null) setValue("valor", valorParaCampo(s.valor_referencia), opcoes);
    if (s.dia_vencimento !== null) {
      setValue("vencimento", vencimentoNoMes(getValues("competencia"), s.dia_vencimento), opcoes);
      vencimentoAuto.current = true;
    }
  }

  function escolherCompetencia(mes: string) {
    setDuplicado(null);
    const nova = competenciaDoMes(mes);
    setValue("competencia", nova, opcoes);
    const s = servicosPorId.get(getValues("servico_id") ?? "");
    if (vencimentoAuto.current && s?.dia_vencimento) {
      setValue("vencimento", vencimentoNoMes(nova, s.dia_vencimento), opcoes);
    }
  }

  const onSubmit = handleSubmit((values) => {
    const confirmar = duplicado !== null;
    startTransition(async () => {
      setEtapa("salvando");
      const result = await executarAcao(() =>
        lancamento
          ? atualizarLancamento(lancamento.id, values, confirmar)
          : criarLancamento(values, confirmar),
      );
      if (!result.ok) {
        if ("duplicado" in result) {
          setDuplicado(result.error);
          return;
        }
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

      let aviso: string | undefined;
      if (arquivo) {
        setEtapa("enviando");
        const envio = await enviarAnexo("financeiro", result.id, arquivo);
        if ("erro" in envio) {
          aviso = envio.erro;
        } else {
          const anexo = await executarAcao(() => anexarArquivoLancamento(result.id, envio.path));
          if (!anexo.ok) aviso = anexo.error;
        }
      }
      onSalvo(aviso);
    });
  });

  const erro = (campo: Campo) => errors[campo]?.message;
  const descrito = (campo: string, mensagem?: string) =>
    mensagem ? `lanc-${campo}-erro` : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="lanc-servico">Serviço</Label>
        <Controller
          control={control}
          name="servico_id"
          render={({ field }) => (
            <ComboboxLista
              id="lanc-servico"
              ref={field.ref}
              opcoes={opcoesServico}
              value={field.value || AVULSO}
              onChange={escolherServico}
              onBlur={field.onBlur}
              placeholderBusca="Buscar fornecedor, descrição ou identificador..."
              vazio="Nenhum serviço encontrado."
              disabled={isPending}
              invalid={Boolean(erro("servico_id"))}
              descritoPor={descrito("servico", erro("servico_id"))}
            />
          )}
        />
        <MensagemErro id="lanc-servico-erro" mensagem={erro("servico_id")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="lanc-competencia">Competência</Label>
          <Select
            value={competencia.slice(0, 7)}
            onValueChange={escolherCompetencia}
            disabled={isPending}
          >
            <SelectTrigger
              id="lanc-competencia"
              className="w-full"
              aria-invalid={Boolean(erro("competencia"))}
              aria-describedby={descrito("competencia", erro("competencia"))}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mesesOpcoes.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatarMes(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MensagemErro id="lanc-competencia-erro" mensagem={erro("competencia")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lanc-tipo">Tipo</Label>
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
                  id="lanc-tipo"
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
          <MensagemErro id="lanc-tipo-erro" mensagem={erro("tipo")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lanc-fornecedor">Fornecedor</Label>
          <Input
            id="lanc-fornecedor"
            autoComplete="off"
            maxLength={150}
            placeholder="Ex.: IBL NET"
            aria-required
            aria-invalid={Boolean(erro("fornecedor"))}
            aria-describedby={descrito("fornecedor", erro("fornecedor"))}
            disabled={isPending}
            {...register("fornecedor")}
          />
          <MensagemErro id="lanc-fornecedor-erro" mensagem={erro("fornecedor")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lanc-descricao">Descrição (opcional)</Label>
          <Input
            id="lanc-descricao"
            autoComplete="off"
            maxLength={150}
            placeholder="Ex.: Link principal"
            aria-invalid={Boolean(erro("descricao"))}
            aria-describedby={descrito("descricao", erro("descricao"))}
            disabled={isPending}
            {...register("descricao")}
          />
          <MensagemErro id="lanc-descricao-erro" mensagem={erro("descricao")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lanc-loja">Filial (opcional)</Label>
          <Controller
            control={control}
            name="loja_id"
            render={({ field }) => (
              <CampoFilial
                id="lanc-loja"
                ref={field.ref}
                lojas={lojas}
                atual={lancamento?.loja_id ?? null}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={isPending}
                invalid={Boolean(erro("loja_id"))}
                descritoPor={descrito("loja", erro("loja_id"))}
              />
            )}
          />
          <MensagemErro id="lanc-loja-erro" mensagem={erro("loja_id")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lanc-vencimento">Vencimento</Label>
          <Controller
            control={control}
            name="vencimento"
            render={({ field }) => (
              <CampoData
                id="lanc-vencimento"
                name={field.name}
                ref={field.ref}
                value={field.value ?? ""}
                onChange={(v) => {
                  vencimentoAuto.current = false;
                  field.onChange(v);
                }}
                onBlur={field.onBlur}
                emitirInvalido
                required
                invalid={Boolean(erro("vencimento"))}
                descritoPor={descrito("vencimento", erro("vencimento"))}
                disabled={isPending}
              />
            )}
          />
          <MensagemErro id="lanc-vencimento-erro" mensagem={erro("vencimento")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lanc-valor">Valor em R$</Label>
          <Input
            id="lanc-valor"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            aria-required
            aria-invalid={Boolean(erro("valor"))}
            aria-describedby={descrito("valor", erro("valor"))}
            disabled={isPending}
            {...register("valor")}
          />
          <MensagemErro id="lanc-valor-erro" mensagem={erro("valor")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lanc-situacao">Situação</Label>
          <Controller
            control={control}
            name="situacao"
            render={({ field }) => (
              <Select
                value={field.value ?? "solicitado_compras"}
                onValueChange={(v) => {
                  if (!ehSituacaoPagamento(v)) return;
                  field.onChange(v);
                  if (v === "pago" && !getValues("data_pagamento")) {
                    setValue("data_pagamento", hojeEmPalmas(), opcoes);
                  }
                }}
                disabled={isPending}
              >
                <SelectTrigger
                  id="lanc-situacao"
                  ref={field.ref}
                  className="w-full"
                  aria-invalid={Boolean(erro("situacao"))}
                  aria-describedby={descrito("situacao", erro("situacao"))}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITUACOES_PAGAMENTO.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SITUACAO_PAGAMENTO_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <MensagemErro id="lanc-situacao-erro" mensagem={erro("situacao")} />
        </div>

        {situacao === "pago" && (
          <div className="grid gap-2">
            <Label htmlFor="lanc-pagamento">Data do pagamento</Label>
            <Controller
              control={control}
              name="data_pagamento"
              render={({ field }) => (
                <CampoData
                  id="lanc-pagamento"
                  name={field.name}
                  ref={field.ref}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  emitirInvalido
                  max={hojeEmPalmas()}
                  required
                  invalid={Boolean(erro("data_pagamento"))}
                  descritoPor={descrito("pagamento", erro("data_pagamento"))}
                  disabled={isPending}
                />
              )}
            />
            <MensagemErro id="lanc-pagamento-erro" mensagem={erro("data_pagamento")} />
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="lanc-id-aprovacao">ID da aprovação (opcional)</Label>
          <Input
            id="lanc-id-aprovacao"
            autoComplete="off"
            maxLength={100}
            aria-invalid={Boolean(erro("id_aprovacao"))}
            aria-describedby={descrito("id-aprovacao", erro("id_aprovacao"))}
            disabled={isPending}
            {...register("id_aprovacao")}
          />
          <MensagemErro id="lanc-id-aprovacao-erro" mensagem={erro("id_aprovacao")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lanc-aprovacao">Aprovação</Label>
          <Controller
            control={control}
            name="aprovacao_ok"
            render={({ field }) => (
              <Select
                value={typeof field.value === "string" && field.value ? field.value : NAO_INFORMADO}
                onValueChange={(v) => field.onChange(v === NAO_INFORMADO ? "" : v)}
                disabled={isPending}
              >
                <SelectTrigger
                  id="lanc-aprovacao"
                  ref={field.ref}
                  className="w-full"
                  aria-invalid={Boolean(erro("aprovacao_ok"))}
                  aria-describedby={descrito("aprovacao", erro("aprovacao_ok"))}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NAO_INFORMADO}>Não informada</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="nao_ok">Não OK</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <MensagemErro id="lanc-aprovacao-erro" mensagem={erro("aprovacao_ok")} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="lanc-observacao">Observação (opcional)</Label>
        <Textarea
          id="lanc-observacao"
          rows={2}
          maxLength={1000}
          aria-invalid={Boolean(erro("observacao"))}
          aria-describedby={descrito("observacao", erro("observacao"))}
          disabled={isPending}
          {...register("observacao")}
        />
        <MensagemErro id="lanc-observacao-erro" mensagem={erro("observacao")} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="lanc-anexo">
          {lancamento?.anexo_path ? "Substituir anexo (opcional)" : "Anexo (opcional)"}
        </Label>
        {lancamento?.anexo_path && (
          <div className="text-sm">
            <LinkAnexoLancamento path={lancamento.anexo_path} />
          </div>
        )}
        <CampoArquivo
          id="lanc-anexo"
          accept={ANEXO_ACCEPT}
          arquivo={arquivo}
          invalid={Boolean(erroArquivo)}
          descritoPor={erroArquivo ? "lanc-anexo-erro lanc-anexo-ajuda" : "lanc-anexo-ajuda"}
          disabled={isPending}
          onChange={(escolhido) => {
            const mensagem = escolhido ? validarArquivoAnexo(escolhido, "O anexo") : null;
            setArquivo(mensagem ? null : escolhido);
            setErroArquivo(mensagem ?? undefined);
          }}
        />
        <p id="lanc-anexo-ajuda" className="text-xs text-muted-foreground">
          Boleto ou nota fiscal: PDF, JPG ou PNG, até 10 MB.
          {lancamento?.anexo_path && " O arquivo escolhido substitui o atual."}
        </p>
        <MensagemErro id="lanc-anexo-erro" mensagem={erroArquivo} />
      </div>

      {duplicado && (
        <p
          role="alert"
          className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-400"
        >
          {duplicado} Confira antes de salvar; se estiver certo, clique em{" "}
          <strong>Salvar mesmo assim</strong>.
        </p>
      )}

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
          {isPending
            ? etapa === "enviando"
              ? "Enviando anexo..."
              : "Salvando..."
            : duplicado
              ? "Salvar mesmo assim"
              : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
