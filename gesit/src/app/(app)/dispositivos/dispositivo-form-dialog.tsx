"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LaptopIcon, SmartphoneIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import {
  Controller,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormRegisterReturn,
} from "react-hook-form";
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
import { TIPO_DISPOSITIVO_LABEL, type TipoDispositivo } from "@/lib/types";
import {
  formatarIMEIDigitando,
  notebookSchema,
  telefoneSchema,
  type NotebookFormData,
  type NotebookFormInput,
  type TelefoneFormData,
  type TelefoneFormInput,
} from "@/lib/validators";

import { atualizarDispositivo, criarDispositivo } from "./actions";

export type DispositivoEditavel = {
  id: string;
  tipo: TipoDispositivo;
  marca: string;
  modelo: string;
  serial_number: string | null;
  imei1: string | null;
  imei2: string | null;
  observacao: string | null;
};

type Props = {
  /** Ausente = cadastro (com seletor de tipo). */
  dispositivo?: DispositivoEditavel;
  trigger: ReactNode;
};

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

  const propsForm = {
    dispositivo,
    onSalvo: () => {
      toast.success(editando ? "Dispositivo atualizado." : "Dispositivo cadastrado.");
      setOpen(false);
    },
    onCancelar: () => setOpen(false),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
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
            className="grid grid-cols-2 gap-2"
          >
            {(["notebook", "telefone"] as const).map((t) => {
              const Icone = t === "notebook" ? LaptopIcon : SmartphoneIcon;
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

        {tipo === "notebook" ? (
          <NotebookForm key="notebook" {...propsForm} />
        ) : (
          <TelefoneForm key="telefone" {...propsForm} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type FormProps = {
  dispositivo?: DispositivoEditavel;
  onSalvo: () => void;
  onCancelar: () => void;
};

function NotebookForm({ dispositivo, onSalvo, onCancelar }: FormProps) {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<NotebookFormInput, unknown, NotebookFormData>({
    resolver: zodResolver(notebookSchema),
    defaultValues: {
      tipo: "notebook",
      marca: dispositivo?.marca ?? "",
      modelo: dispositivo?.modelo ?? "",
      serial_number: dispositivo?.serial_number ?? "",
      observacao: dispositivo?.observacao ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = dispositivo
        ? await atualizarDispositivo(dispositivo.id, values)
        : await criarDispositivo(values);
      if (!result.ok) {
        aplicarErros(result, setError);
        return;
      }
      onSalvo();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <CamposComuns register={register} errors={errors} disabled={isPending} />
      <CampoTexto
        id="disp-serial"
        rotulo="Serial Number"
        erro={errors.serial_number?.message}
        disabled={isPending}
        registro={register("serial_number")}
      />
      <CampoObservacao register={register} errors={errors} disabled={isPending} />
      <Rodape erro={errors.root?.message} isPending={isPending} onCancelar={onCancelar} />
    </form>
  );
}

function TelefoneForm({ dispositivo, onSalvo, onCancelar }: FormProps) {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TelefoneFormInput, unknown, TelefoneFormData>({
    resolver: zodResolver(telefoneSchema),
    defaultValues: {
      tipo: "telefone",
      marca: dispositivo?.marca ?? "",
      modelo: dispositivo?.modelo ?? "",
      serial_number: dispositivo?.serial_number ?? "",
      imei1: formatarIMEIDigitando(dispositivo?.imei1 ?? ""),
      imei2: formatarIMEIDigitando(dispositivo?.imei2 ?? ""),
      observacao: dispositivo?.observacao ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = dispositivo
        ? await atualizarDispositivo(dispositivo.id, values)
        : await criarDispositivo(values);
      if (!result.ok) {
        aplicarErros(result, setError);
        return;
      }
      onSalvo();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <CamposComuns register={register} errors={errors} disabled={isPending} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoImei
          control={control}
          name="imei1"
          rotulo="IMEI 1"
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
      </div>
      <CampoTexto
        id="disp-serial"
        rotulo="Serial Number (opcional)"
        erro={errors.serial_number?.message}
        disabled={isPending}
        registro={register("serial_number")}
      />
      <CampoObservacao register={register} errors={errors} disabled={isPending} />
      <Rodape erro={errors.root?.message} isPending={isPending} onCancelar={onCancelar} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Peças do formulário
// ---------------------------------------------------------------------------

type ResultadoErro = {
  error: string;
  fieldErrors?: Partial<Record<string, string>>;
};

function aplicarErros(
  result: ResultadoErro,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setError: (campo: any, erro: { message: string }) => void,
) {
  const campos = Object.entries(result.fieldErrors ?? {});
  for (const [campo, mensagem] of campos) {
    if (mensagem) setError(campo, { message: mensagem });
  }
  if (campos.length === 0) setError("root", { message: result.error });
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
        autoFocus
        erro={errors.marca?.message}
        disabled={disabled}
        registro={register("marca")}
      />
      <CampoTexto
        id="disp-modelo"
        rotulo="Modelo"
        erro={errors.modelo?.message}
        disabled={disabled}
        registro={register("modelo")}
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
}: {
  id: string;
  rotulo: string;
  erro?: string;
  disabled: boolean;
  registro: UseFormRegisterReturn;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-invalid={Boolean(erro)}
        disabled={disabled}
        {...registro}
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}

function CampoImei({
  control,
  name,
  rotulo,
  erro,
  disabled,
}: {
  control: Control<TelefoneFormInput, unknown, TelefoneFormData>;
  name: "imei1" | "imei2";
  rotulo: string;
  erro?: string;
  disabled: boolean;
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
            aria-invalid={Boolean(erro)}
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
      {erro && <p className="text-sm text-destructive">{erro}</p>}
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
      <textarea
        id="disp-obs"
        rows={2}
        aria-invalid={Boolean(erro)}
        disabled={disabled}
        className="min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30"
        {...register("observacao")}
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}

function Rodape({
  erro,
  isPending,
  onCancelar,
}: {
  erro?: string;
  isPending: boolean;
  onCancelar: () => void;
}) {
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
        <Button type="button" variant="outline" onClick={onCancelar} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </>
  );
}
