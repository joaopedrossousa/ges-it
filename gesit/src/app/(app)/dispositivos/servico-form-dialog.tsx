"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
import { toast } from "sonner";

import { CampoArquivo } from "@/components/campo-arquivo";
import { CampoData } from "@/components/campo-data";
import { Carregando } from "@/components/carregando";
import { ComboboxLista } from "@/components/combobox-lista";
import { LinkAnexoServico } from "@/components/link-anexo-servico";
import { MensagemErro } from "@/components/mensagem-erro";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { ANEXO_ACCEPT, enviarAnexo, validarArquivoAnexo } from "@/lib/anexos";
import { executarAcao } from "@/lib/executar-acao";
import { hojeEmPalmas } from "@/lib/format";
import { TIPOS_SERVICO, TIPO_SERVICO_LABEL, type TipoServico } from "@/lib/types";
import {
  servicoSchema,
  valorParaCampo,
  type ServicoFormData,
  type ServicoFormInput,
} from "@/lib/validators";

import { anexarArquivoServico, atualizarServico, criarServico } from "./actions";

export type ServicoEditavel = {
  id: string;
  tipo: TipoServico;
  data_servico: string;
  fornecedor: string | null;
  custo: number | null;
  na_garantia: boolean;
  descricao: string | null;
  anexo_path: string | null;
};

type Props = {
  dispositivoId: string;
  /** Ausente = registrar novo serviço. */
  servico?: ServicoEditavel;
  trigger: ReactNode;
};

const OPCOES_TIPO = TIPOS_SERVICO.map((t) => ({ value: t, label: TIPO_SERVICO_LABEL[t] }));

const CAMPOS = [
  "tipo",
  "data_servico",
  "fornecedor",
  "custo",
  "na_garantia",
  "descricao",
] as const satisfies readonly Path<ServicoFormInput>[];

export function ServicoFormDialog({ dispositivoId, servico, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const editando = Boolean(servico);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar serviço" : "Registrar serviço"}</DialogTitle>
          <DialogDescription>
            Manutenção feita no dispositivo, por técnico interno ou empresa.
          </DialogDescription>
        </DialogHeader>
        {/* O formulário só existe com o diálogo aberto: reabrir começa do zero. */}
        <FormServico
          dispositivoId={dispositivoId}
          servico={servico}
          onSalvo={(aviso) => {
            toast.success(editando ? "Serviço atualizado." : "Serviço registrado.");
            if (aviso) {
              toast.warning("O anexo não foi salvo.", {
                description: `${aviso} Tente de novo pelo botão Editar do serviço.`,
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

function FormServico({
  dispositivoId,
  servico,
  onSalvo,
  onCancelar,
}: {
  dispositivoId: string;
  servico?: ServicoEditavel;
  /** `aviso`: os dados foram salvos, mas o anexo não. */
  onSalvo: (aviso?: string) => void;
  onCancelar: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [etapa, setEtapa] = useState<"salvando" | "enviando">("salvando");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | undefined>();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ServicoFormInput, unknown, ServicoFormData>({
    resolver: zodResolver(servicoSchema),
    defaultValues: {
      tipo: servico?.tipo,
      data_servico: servico?.data_servico ?? hojeEmPalmas(),
      fornecedor: servico?.fornecedor ?? "",
      custo: valorParaCampo(servico?.custo),
      na_garantia: servico?.na_garantia ?? false,
      descricao: servico?.descricao ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      setEtapa("salvando");
      const result = await executarAcao(() =>
        servico ? atualizarServico(servico.id, values) : criarServico(dispositivoId, values),
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

      // No registro, criarServico devolve o id do novo serviço.
      const id =
        servico?.id ?? ("id" in result && typeof result.id === "string" ? result.id : undefined);
      let aviso: string | undefined;
      if (arquivo && id) {
        setEtapa("enviando");
        const envio = await enviarAnexo("servicos", dispositivoId, arquivo);
        if ("erro" in envio) {
          aviso = envio.erro;
        } else {
          const anexo = await executarAcao(() => anexarArquivoServico(id, envio.path));
          if (!anexo.ok) aviso = anexo.error;
        }
      }
      onSalvo(aviso);
    });
  });

  const erro = (campo: (typeof CAMPOS)[number]) => errors[campo]?.message;
  const descrito = (campo: string, mensagem?: string) =>
    mensagem ? `serv-${campo}-erro` : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="serv-tipo">Tipo de serviço</Label>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <ComboboxLista
                id="serv-tipo"
                ref={field.ref}
                opcoes={OPCOES_TIPO}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholderBusca="Buscar tipo..."
                vazio="Nenhum tipo encontrado."
                disabled={isPending}
                required
                invalid={Boolean(erro("tipo"))}
                descritoPor={descrito("tipo", erro("tipo"))}
              />
            )}
          />
          <MensagemErro id="serv-tipo-erro" mensagem={erro("tipo")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="serv-data">Data do serviço</Label>
          <Controller
            control={control}
            name="data_servico"
            render={({ field }) => (
              <CampoData
                id="serv-data"
                name={field.name}
                ref={field.ref}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                emitirInvalido
                max={hojeEmPalmas()}
                required
                invalid={Boolean(erro("data_servico"))}
                descritoPor={descrito("data", erro("data_servico"))}
                disabled={isPending}
              />
            )}
          />
          <MensagemErro id="serv-data-erro" mensagem={erro("data_servico")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="serv-fornecedor">Fornecedor (opcional)</Label>
          <Input
            id="serv-fornecedor"
            autoComplete="off"
            maxLength={150}
            placeholder="Técnico interno ou empresa"
            aria-invalid={Boolean(erro("fornecedor"))}
            aria-describedby={descrito("fornecedor", erro("fornecedor"))}
            disabled={isPending}
            {...register("fornecedor")}
          />
          <MensagemErro id="serv-fornecedor-erro" mensagem={erro("fornecedor")} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="serv-custo">Custo em R$ (opcional)</Label>
          <Input
            id="serv-custo"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            aria-invalid={Boolean(erro("custo"))}
            aria-describedby={descrito("custo", erro("custo"))}
            disabled={isPending}
            {...register("custo")}
          />
          <MensagemErro id="serv-custo-erro" mensagem={erro("custo")} />
        </div>
      </div>

      <Controller
        control={control}
        name="na_garantia"
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Checkbox
              id="serv-garantia"
              ref={field.ref}
              checked={field.value ?? false}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
              disabled={isPending}
            />
            <Label htmlFor="serv-garantia" className="font-normal">
              Feito na garantia
            </Label>
          </div>
        )}
      />

      <div className="grid gap-2">
        <Label htmlFor="serv-descricao">Descrição (opcional, exceto para Outro)</Label>
        <Textarea
          id="serv-descricao"
          rows={3}
          maxLength={1000}
          aria-invalid={Boolean(erro("descricao"))}
          aria-describedby={descrito("descricao", erro("descricao"))}
          disabled={isPending}
          {...register("descricao")}
        />
        <MensagemErro id="serv-descricao-erro" mensagem={erro("descricao")} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="serv-anexo">
          {servico?.anexo_path ? "Substituir anexo (opcional)" : "Anexo (opcional)"}
        </Label>
        {servico?.anexo_path && (
          <div className="text-sm">
            <LinkAnexoServico path={servico.anexo_path} />
          </div>
        )}
        <CampoArquivo
          id="serv-anexo"
          accept={ANEXO_ACCEPT}
          arquivo={arquivo}
          invalid={Boolean(erroArquivo)}
          descritoPor={erroArquivo ? "serv-anexo-erro serv-anexo-ajuda" : "serv-anexo-ajuda"}
          disabled={isPending}
          onChange={(escolhido) => {
            const mensagem = escolhido ? validarArquivoAnexo(escolhido, "O anexo") : null;
            setArquivo(mensagem ? null : escolhido);
            setErroArquivo(mensagem ?? undefined);
          }}
        />
        <p id="serv-anexo-ajuda" className="text-xs text-muted-foreground">
          Nota, orçamento ou laudo: PDF, JPG ou PNG, até 10 MB.
          {servico?.anexo_path && " O arquivo escolhido substitui o atual."}
        </p>
        <MensagemErro id="serv-anexo-erro" mensagem={erroArquivo} />
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
          {!isPending ? "Salvar" : etapa === "enviando" ? "Enviando anexo..." : "Salvando..."}
        </Button>
      </DialogFooter>
    </form>
  );
}
