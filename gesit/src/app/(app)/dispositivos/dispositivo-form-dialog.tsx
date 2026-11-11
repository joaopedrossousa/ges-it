"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LaptopIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import {
  Controller,
  useForm,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegisterReturn,
  type UseFormSetError,
} from "react-hook-form";
import { toast } from "sonner";

import { Carregando } from "@/components/carregando";
import { LinkNotaFiscal } from "@/components/link-nota-fiscal";
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
import { executarAcao } from "@/lib/executar-acao";
import { hojeEmPalmas } from "@/lib/format";
import {
  NOTA_FISCAL_ACCEPT,
  enviarNotaFiscal,
  validarArquivoNotaFiscal,
} from "@/lib/notas-fiscais";
import {
  OPERADORAS,
  TIPO_DISPOSITIVO_LABEL,
  paraOperadora,
  type TipoDispositivo,
} from "@/lib/types";
import {
  exigirDataCompra,
  formatarIMEIDigitando,
  formatarLinhaDigitando,
  monitorSchema,
  notebookSchema,
  telefoneSchema,
  type DispositivoFormData,
  type MonitorFormData,
  type MonitorFormInput,
  type NotebookFormData,
  type NotebookFormInput,
  type TelefoneFormData,
  type TelefoneFormInput,
} from "@/lib/validators";

import { anexarNotaFiscal, atualizarDispositivo, criarDispositivo } from "./actions";

export type DispositivoEditavel = {
  id: string;
  tipo: TipoDispositivo;
  marca: string;
  modelo: string;
  serial_number: string | null;
  imei1: string | null;
  imei2: string | null;
  numero_patrimonio: string | null;
  numero_linha: string | null;
  operadora: string | null;
  data_compra: string | null;
  fim_vida_util: string | null;
  nota_fiscal_path: string | null;
  observacao: string | null;
};

type Props = {
  /** Ausente = cadastro (com seletor de tipo). */
  dispositivo?: DispositivoEditavel;
  trigger: ReactNode;
};

const ICONE_TIPO = {
  notebook: LaptopIcon,
  telefone: SmartphoneIcon,
  monitor: MonitorIcon,
} satisfies Record<TipoDispositivo, unknown>;

const TIPOS_CADASTRO = ["notebook", "telefone", "monitor"] as const satisfies readonly TipoDispositivo[];

export function DispositivoFormDialog({ dispositivo, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoDispositivo>(
    dispositivo?.tipo ?? "notebook",
  );
  const editando = Boolean(dispositivo);

  function onOpenChange(next: boolean) {
    if (next && !dispositivo) setTipo("notebook");
    setOpen(next);
  }

  const propsForm: FormProps = {
    dispositivo,
    onSalvo: (avisoNotaFiscal) => {
      toast.success(editando ? "Dispositivo atualizado." : "Dispositivo cadastrado.");
      if (avisoNotaFiscal) {
        toast.warning("A nota fiscal não foi anexada.", {
          description: `${avisoNotaFiscal} Tente de novo pela edição do dispositivo.`,
          duration: 15000,
        });
      }
      setOpen(false);
    },
    onCancelar: () => setOpen(false),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editando
              ? `Editar ${TIPO_DISPOSITIVO_LABEL[tipo].toLowerCase()}`
              : "Novo dispositivo"}
          </DialogTitle>
          <DialogDescription>
            {editando
              ? "Altere os dados do dispositivo."
              : "Escolha o tipo e preencha os dados."}
          </DialogDescription>
        </DialogHeader>

        {!editando && (
          <div
            role="radiogroup"
            aria-label="Tipo de dispositivo"
            className="grid grid-cols-3 gap-2"
          >
            {TIPOS_CADASTRO.map((t) => {
              const Icone = ICONE_TIPO[t];
              const ativo = tipo === t;
              return (
                <Button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  variant={ativo ? "default" : "outline"}
                  onClick={() => setTipo(t)}
                >
                  <Icone />
                  {TIPO_DISPOSITIVO_LABEL[t]}
                </Button>
              );
            })}
          </div>
        )}

        {tipo === "notebook" && <NotebookForm key="notebook" {...propsForm} />}
        {tipo === "telefone" && <TelefoneForm key="telefone" {...propsForm} />}
        {tipo === "monitor" && <MonitorForm key="monitor" {...propsForm} />}
      </DialogContent>
    </Dialog>
  );
}

type FormProps = {
  dispositivo?: DispositivoEditavel;
  /** `avisoNotaFiscal`: os dados foram salvos, mas a nota fiscal não. */
  onSalvo: (avisoNotaFiscal?: string) => void;
  onCancelar: () => void;
};

/** Valores iniciais dos campos comuns aos três tipos. */
function valoresComuns(d?: DispositivoEditavel) {
  return {
    marca: d?.marca ?? "",
    modelo: d?.modelo ?? "",
    numero_patrimonio: d?.numero_patrimonio ?? "",
    data_compra: d?.data_compra ?? "",
    fim_vida_util: d?.fim_vida_util ?? "",
    observacao: d?.observacao ?? "",
  };
}

const CAMPOS_COMUNS = [
  "marca",
  "modelo",
  "numero_patrimonio",
  "data_compra",
  "fim_vida_util",
  "observacao",
] as const;

function NotebookForm({ dispositivo, onSalvo, onCancelar }: FormProps) {
  const { salvar, isPending, etapa } = useSalvarDispositivo(dispositivo, onSalvo);
  const nota = useNotaFiscal();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<NotebookFormInput, unknown, NotebookFormData>({
    resolver: zodResolver(dispositivo ? notebookSchema : exigirDataCompra(notebookSchema)),
    defaultValues: {
      tipo: "notebook",
      ...valoresComuns(dispositivo),
      serial_number: dispositivo?.serial_number ?? "",
    },
  });

  const onSubmit = handleSubmit((values) =>
    salvar(values, nota.arquivo, (r) =>
      aplicarErros(r, setError, [...CAMPOS_COMUNS, "serial_number"]),
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <CamposComuns register={register} errors={errors} disabled={isPending} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          id="disp-serial"
          rotulo="Serial Number"
          obrigatorio
          erro={errors.serial_number?.message}
          disabled={isPending}
          registro={register("serial_number")}
        />
        <CampoPatrimonio register={register} errors={errors} disabled={isPending} />
      </div>
      <CamposAquisicao
        register={register}
        errors={errors}
        disabled={isPending}
        novo={!dispositivo}
      />
      <CampoNotaFiscal nota={nota} atual={dispositivo?.nota_fiscal_path ?? null} disabled={isPending} />
      <CampoObservacao register={register} errors={errors} disabled={isPending} />
      <Rodape erro={errors.root?.message} etapa={etapa} onCancelar={onCancelar} />
    </form>
  );
}

function TelefoneForm({ dispositivo, onSalvo, onCancelar }: FormProps) {
  const { salvar, isPending, etapa } = useSalvarDispositivo(dispositivo, onSalvo);
  const nota = useNotaFiscal();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TelefoneFormInput, unknown, TelefoneFormData>({
    resolver: zodResolver(dispositivo ? telefoneSchema : exigirDataCompra(telefoneSchema)),
    defaultValues: {
      tipo: "telefone",
      ...valoresComuns(dispositivo),
      serial_number: dispositivo?.serial_number ?? "",
      imei1: formatarIMEIDigitando(dispositivo?.imei1 ?? ""),
      imei2: formatarIMEIDigitando(dispositivo?.imei2 ?? ""),
      numero_linha: formatarLinhaDigitando(dispositivo?.numero_linha ?? ""),
      operadora: paraOperadora(dispositivo?.operadora),
    },
  });

  const onSubmit = handleSubmit((values) =>
    salvar(values, nota.arquivo, (r) =>
      aplicarErros(r, setError, [
        ...CAMPOS_COMUNS,
        "imei1",
        "imei2",
        "serial_number",
        "numero_linha",
        "operadora",
      ]),
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <CamposComuns register={register} errors={errors} disabled={isPending} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoImei
          control={control}
          name="imei1"
          rotulo="IMEI 1"
          obrigatorio
          erro={errors.imei1?.message}
          disabled={isPending}
        />
        <CampoImei
          control={control}
          name="imei2"
          rotulo="IMEI 2 (opcional)"
          erro={errors.imei2?.message}
          disabled={isPending}
        />
        <CampoTexto
          id="disp-serial"
          rotulo="Serial Number (opcional)"
          erro={errors.serial_number?.message}
          disabled={isPending}
          registro={register("serial_number")}
        />
        <CampoPatrimonio register={register} errors={errors} disabled={isPending} />
        <CampoLinha control={control} erro={errors.numero_linha?.message} disabled={isPending} />
        <CampoOperadora control={control} erro={errors.operadora?.message} disabled={isPending} />
      </div>
      <CamposAquisicao
        register={register}
        errors={errors}
        disabled={isPending}
        novo={!dispositivo}
      />
      <CampoNotaFiscal nota={nota} atual={dispositivo?.nota_fiscal_path ?? null} disabled={isPending} />
      <CampoObservacao register={register} errors={errors} disabled={isPending} />
      <Rodape erro={errors.root?.message} etapa={etapa} onCancelar={onCancelar} />
    </form>
  );
}

function MonitorForm({ dispositivo, onSalvo, onCancelar }: FormProps) {
  const { salvar, isPending, etapa } = useSalvarDispositivo(dispositivo, onSalvo);
  const nota = useNotaFiscal();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MonitorFormInput, unknown, MonitorFormData>({
    resolver: zodResolver(dispositivo ? monitorSchema : exigirDataCompra(monitorSchema)),
    defaultValues: {
      tipo: "monitor",
      ...valoresComuns(dispositivo),
    },
  });

  const onSubmit = handleSubmit((values) =>
    salvar(values, nota.arquivo, (r) => aplicarErros(r, setError, CAMPOS_COMUNS)),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <CamposComuns register={register} errors={errors} disabled={isPending} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoPatrimonio
          register={register}
          errors={errors}
          disabled={isPending}
          obrigatorio
        />
      </div>
      <CamposAquisicao
        register={register}
        errors={errors}
        disabled={isPending}
        novo={!dispositivo}
      />
      <CampoNotaFiscal nota={nota} atual={dispositivo?.nota_fiscal_path ?? null} disabled={isPending} />
      <CampoObservacao register={register} errors={errors} disabled={isPending} />
      <Rodape erro={errors.root?.message} etapa={etapa} onCancelar={onCancelar} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Salvar + nota fiscal
// ---------------------------------------------------------------------------

type Etapa = "salvando" | "enviando" | null;

type ResultadoErro = {
  error: string;
  fieldErrors?: Partial<Record<string, string>>;
};

/**
 * Salva os dados e, se houver arquivo, envia a nota fiscal para
 * notas-fiscais/{id}/{timestamp}.{ext} e grava o caminho no dispositivo.
 * A nota vai depois dos dados: um erro de validação não deixa arquivo órfão,
 * e no cadastro o id só existe depois do insert.
 */
function useSalvarDispositivo(
  dispositivo: DispositivoEditavel | undefined,
  onSalvo: FormProps["onSalvo"],
) {
  const [isPending, startTransition] = useTransition();
  const [etapa, setEtapa] = useState<Etapa>(null);

  function salvar(
    values: DispositivoFormData,
    arquivo: File | null,
    onErro: (r: ResultadoErro) => void,
  ) {
    startTransition(async () => {
      setEtapa("salvando");
      const result = await executarAcao(() =>
        dispositivo ? atualizarDispositivo(dispositivo.id, values) : criarDispositivo(values),
      );
      if (!result.ok) {
        setEtapa(null);
        onErro(result);
        return;
      }

      // No cadastro, criarDispositivo devolve o id do novo dispositivo.
      const id =
        dispositivo?.id ??
        ("id" in result && typeof result.id === "string" ? result.id : undefined);
      let aviso: string | undefined;
      if (arquivo && id) {
        setEtapa("enviando");
        const envio = await enviarNotaFiscal(id, arquivo);
        if ("erro" in envio) {
          aviso = envio.erro;
        } else {
          const anexo = await executarAcao(() => anexarNotaFiscal(id, envio.path));
          if (!anexo.ok) aviso = anexo.error;
        }
      }
      setEtapa(null);
      onSalvo(aviso);
    });
  }

  return { salvar, isPending, etapa: isPending ? (etapa ?? "salvando") : null };
}

type NotaFiscalEstado = ReturnType<typeof useNotaFiscal>;

function useNotaFiscal() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | undefined>();

  function escolher(input: HTMLInputElement) {
    const escolhido = input.files?.[0] ?? null;
    const mensagem = validarArquivoNotaFiscal(escolhido);
    if (mensagem) {
      input.value = "";
      setArquivo(null);
      setErro(mensagem);
      return;
    }
    setArquivo(escolhido);
    setErro(undefined);
  }

  return { arquivo, erro, escolher };
}

// ---------------------------------------------------------------------------
// Peças do formulário
// ---------------------------------------------------------------------------

/**
 * Mostra os erros do servidor nos campos do formulário; se nenhum campo
 * tiver erro, mostra a mensagem geral (root).
 */
function aplicarErros<T extends FieldValues>(
  result: ResultadoErro,
  setError: UseFormSetError<T>,
  campos: readonly Path<T>[],
) {
  let algum = false;
  for (const campo of campos) {
    const mensagem = result.fieldErrors?.[campo];
    if (mensagem) {
      setError(campo, { message: mensagem });
      algum = true;
    }
  }
  if (!algum) setError("root", { message: result.error });
}

type CamposComunsProps = {
  register: (campo: "marca" | "modelo") => UseFormRegisterReturn;
  errors: FieldErrors<{ marca: string; modelo: string }>;
  disabled: boolean;
};

function CamposComuns({ register, errors, disabled }: CamposComunsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto
        id="disp-marca"
        rotulo="Marca"
        obrigatorio
        autoFocus
        erro={errors.marca?.message}
        disabled={disabled}
        registro={register("marca")}
      />
      <CampoTexto
        id="disp-modelo"
        rotulo="Modelo"
        obrigatorio
        erro={errors.modelo?.message}
        disabled={disabled}
        registro={register("modelo")}
      />
    </div>
  );
}

function CampoPatrimonio({
  register,
  errors,
  disabled,
  obrigatorio,
}: {
  register: (campo: "numero_patrimonio") => UseFormRegisterReturn;
  errors: FieldErrors<{ numero_patrimonio: string }>;
  disabled: boolean;
  obrigatorio?: boolean;
}) {
  return (
    <CampoTexto
      id="disp-patrimonio"
      rotulo={obrigatorio ? "Nº de patrimônio" : "Nº de patrimônio (opcional)"}
      obrigatorio={obrigatorio}
      erro={errors.numero_patrimonio?.message}
      disabled={disabled}
      registro={register("numero_patrimonio")}
    />
  );
}

/** Data de compra (obrigatória no cadastro novo) e fim da vida útil. */
function CamposAquisicao({
  register,
  errors,
  disabled,
  novo,
}: {
  register: (campo: "data_compra" | "fim_vida_util") => UseFormRegisterReturn;
  errors: FieldErrors<{ data_compra: string; fim_vida_util: string }>;
  disabled: boolean;
  novo: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto
        id="disp-data-compra"
        rotulo={novo ? "Data de compra" : "Data de compra (opcional)"}
        type="date"
        max={hojeEmPalmas()}
        obrigatorio={novo}
        erro={errors.data_compra?.message}
        disabled={disabled}
        registro={register("data_compra")}
      />
      <CampoTexto
        id="disp-fim-vida-util"
        rotulo="Fim da vida útil (opcional)"
        type="date"
        erro={errors.fim_vida_util?.message}
        disabled={disabled}
        registro={register("fim_vida_util")}
      />
    </div>
  );
}

function CampoTexto({
  id,
  rotulo,
  erro,
  disabled,
  registro,
  autoFocus,
  obrigatorio,
  type,
  max,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  disabled: boolean;
  registro: UseFormRegisterReturn;
  autoFocus?: boolean;
  obrigatorio?: boolean;
  type?: "text" | "date";
  max?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        type={type}
        max={max}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-required={obrigatorio || undefined}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? `${id}-erro` : undefined}
        disabled={disabled}
        {...registro}
      />
      <MensagemErro id={`${id}-erro`} mensagem={erro} />
    </div>
  );
}

function CampoImei({
  control,
  name,
  rotulo,
  erro,
  disabled,
  obrigatorio,
}: {
  control: Control<TelefoneFormInput, unknown, TelefoneFormData>;
  name: "imei1" | "imei2";
  rotulo: string;
  erro?: string;
  disabled: boolean;
  obrigatorio?: boolean;
}) {
  const id = `disp-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            placeholder="00-000000-000000-0"
            maxLength={18}
            aria-required={obrigatorio || undefined}
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? `${id}-erro` : undefined}
            disabled={disabled}
            name={field.name}
            ref={field.ref}
            value={field.value ?? ""}
            onBlur={field.onBlur}
            onChange={(e) => field.onChange(formatarIMEIDigitando(e.target.value))}
            className="font-mono"
          />
        )}
      />
      <MensagemErro id={`${id}-erro`} mensagem={erro} />
    </div>
  );
}

function CampoLinha({
  control,
  erro,
  disabled,
}: {
  control: Control<TelefoneFormInput, unknown, TelefoneFormData>;
  erro?: string;
  disabled: boolean;
}) {
  const id = "disp-linha";
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Número da linha (opcional)</Label>
      <Controller
        control={control}
        name="numero_linha"
        render={({ field }) => (
          <Input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder="(63) 99999-9999"
            maxLength={15}
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? `${id}-erro` : undefined}
            disabled={disabled}
            name={field.name}
            ref={field.ref}
            value={field.value ?? ""}
            onBlur={field.onBlur}
            onChange={(e) => field.onChange(formatarLinhaDigitando(e.target.value))}
          />
        )}
      />
      <MensagemErro id={`${id}-erro`} mensagem={erro} />
    </div>
  );
}

/** Valor do Select para "sem operadora" (o Radix não aceita value vazio). */
const SEM_OPERADORA = "nenhuma";

function CampoOperadora({
  control,
  erro,
  disabled,
}: {
  control: Control<TelefoneFormInput, unknown, TelefoneFormData>;
  erro?: string;
  disabled: boolean;
}) {
  const id = "disp-operadora";
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Operadora (opcional)</Label>
      <Controller
        control={control}
        name="operadora"
        render={({ field }) => (
          <Select
            value={field.value ?? SEM_OPERADORA}
            onValueChange={(v) => field.onChange(paraOperadora(v))}
            disabled={disabled}
          >
            <SelectTrigger
              id={id}
              ref={field.ref}
              onBlur={field.onBlur}
              className="w-full"
              aria-invalid={Boolean(erro)}
              aria-describedby={erro ? `${id}-erro` : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_OPERADORA}>Não informada</SelectItem>
              {OPERADORAS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <MensagemErro id={`${id}-erro`} mensagem={erro} />
    </div>
  );
}

function CampoNotaFiscal({
  nota,
  atual,
  disabled,
}: {
  nota: NotaFiscalEstado;
  /** Caminho da nota já anexada (edição). */
  atual: string | null;
  disabled: boolean;
}) {
  const id = "disp-nota-fiscal";
  const ajuda = `${id}-ajuda`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {atual ? "Substituir nota fiscal (opcional)" : "Nota fiscal (opcional)"}
      </Label>
      {atual && (
        <div className="text-sm">
          <LinkNotaFiscal path={atual} />
        </div>
      )}
      <Input
        id={id}
        type="file"
        accept={NOTA_FISCAL_ACCEPT}
        aria-invalid={Boolean(nota.erro)}
        aria-describedby={nota.erro ? `${id}-erro ${ajuda}` : ajuda}
        disabled={disabled}
        onChange={(e) => nota.escolher(e.currentTarget)}
      />
      <p id={ajuda} className="text-xs text-muted-foreground">
        PDF, JPG ou PNG, até 10 MB.
        {atual && " O arquivo escolhido substitui a nota atual."}
      </p>
      <MensagemErro id={`${id}-erro`} mensagem={nota.erro} />
    </div>
  );
}

function CampoObservacao({
  register,
  errors,
  disabled,
}: {
  register: (campo: "observacao") => UseFormRegisterReturn;
  errors: FieldErrors<{ observacao: string }>;
  disabled: boolean;
}) {
  const erro = errors.observacao?.message;
  return (
    <div className="grid gap-2">
      <Label htmlFor="disp-obs">Observação (opcional)</Label>
      <Textarea
        id="disp-obs"
        rows={2}
        maxLength={1000}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? "disp-obs-erro" : undefined}
        disabled={disabled}
        {...register("observacao")}
      />
      <MensagemErro id="disp-obs-erro" mensagem={erro} />
    </div>
  );
}

function Rodape({
  erro,
  etapa,
  onCancelar,
}: {
  erro?: string;
  etapa: Etapa;
  onCancelar: () => void;
}) {
  const ocupado = etapa !== null;
  return (
    <>
      {erro && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button type="submit" disabled={ocupado}>
          {ocupado && <Carregando decorativo tamanho="sm" />}
          {etapa === "enviando"
            ? "Enviando nota fiscal..."
            : ocupado
              ? "Salvando..."
              : "Salvar"}
        </Button>
      </DialogFooter>
    </>
  );
}
