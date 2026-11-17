"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArchiveIcon, SirenIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { CampoCategorias } from "@/components/atividades/campo-categorias";
import { AmostraCor } from "@/components/atividades/etiquetas";
import { CampoData } from "@/components/campo-data";
import { Carregando } from "@/components/carregando";
import { ComboboxLista } from "@/components/combobox-lista";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  PRIORIDADE_LABEL,
  nomeUsuario,
  type AtividadeQuadro,
  type CategoriaKanban,
  type ColunaQuadro,
  type UsuarioSistema,
} from "@/lib/atividades";
import { executarAcao } from "@/lib/executar-acao";
import { formatarDataHora } from "@/lib/format";
import { PRIORIDADES_ATIVIDADE, type PrioridadeAtividade } from "@/lib/types";
import {
  atividadeSchema,
  type AtividadeFormData,
  type AtividadeFormInput,
} from "@/lib/validators";

import {
  arquivarAtividade,
  atualizarAtividade,
  criarAtividade,
  marcarUrgente,
  restaurarAtividade,
} from "./actions";
import { ComentariosAtividade } from "./comentarios-atividade";

/** O que o painel mostra: nova atividade numa coluna ou edição de uma existente. */
export type EstadoPainel = { modo: "nova"; colunaId: string } | { modo: "editar"; id: string } | null;

type Props = {
  estado: EstadoPainel;
  /** Resolvida pelo quadro a partir do id (null se sumiu, ex.: arquivada por outra pessoa). */
  atividade: AtividadeQuadro | null;
  colunas: ColunaQuadro[];
  categorias: CategoriaKanban[];
  usuarios: UsuarioSistema[];
  /** Usuário logado (autor dos comentários). */
  usuarioId: string | null;
  onFechar: () => void;
};

export function PainelAtividade({
  estado,
  atividade,
  colunas,
  categorias,
  usuarios,
  usuarioId,
  onFechar,
}: Props) {
  const aberto = estado !== null && (estado.modo === "nova" || atividade !== null);
  const editando = estado?.modo === "editar";

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent aria-describedby="painel-atividade-descricao">
        <SheetHeader>
          <SheetTitle>{editando ? "Editar Atividade" : "Nova Atividade"}</SheetTitle>
          <SheetDescription id="painel-atividade-descricao">
            {editando && atividade
              ? `Criada em ${formatarDataHora(atividade.created_at)}${
                  atividade.criado_por
                    ? ` por ${nomeUsuario(usuarios.find((u) => u.id === atividade.criado_por))}`
                    : ""
                }.`
              : "Preencha o título; o resto é opcional."}
          </SheetDescription>
        </SheetHeader>
        {aberto && (
          <FormAtividade
            // Trocar de atividade recomeça o formulário.
            key={editando ? atividade?.id : `nova-${estado?.modo === "nova" ? estado.colunaId : ""}`}
            atividade={editando ? atividade : null}
            colunaInicial={estado?.modo === "nova" ? estado.colunaId : (atividade?.coluna_id ?? "")}
            colunas={colunas}
            categorias={categorias}
            usuarios={usuarios}
            usuarioId={usuarioId}
            onFechar={onFechar}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type Campo = keyof AtividadeFormInput;
const CAMPOS: Campo[] = ["titulo", "prioridade", "coluna_id", "categorias", "responsavel_id", "prazo"];

function FormAtividade({
  atividade,
  colunaInicial,
  colunas,
  categorias,
  usuarios,
  usuarioId,
  onFechar,
}: {
  atividade: AtividadeQuadro | null;
  colunaInicial: string;
  colunas: ColunaQuadro[];
  categorias: CategoriaKanban[];
  usuarios: UsuarioSistema[];
  usuarioId: string | null;
  onFechar: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);
  // Nova atividade: aplicado logo depois de criar.
  const [urgenteNova, setUrgenteNova] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AtividadeFormInput, unknown, AtividadeFormData>({
    resolver: zodResolver(atividadeSchema),
    defaultValues: {
      titulo: atividade?.titulo ?? "",
      prioridade: atividade?.prioridade ?? "media",
      coluna_id: colunaInicial,
      categorias: atividade?.categorias ?? [],
      responsavel_id: atividade?.responsavel_id ?? "",
      prazo: atividade?.prazo ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const r = await executarAcao(() =>
        atividade ? atualizarAtividade(atividade.id, values) : criarAtividade(values),
      );
      // Nova e marcada como urgente: a flag vai numa chamada própria.
      if (r.ok && !atividade && urgenteNova && "id" in r && typeof r.id === "string") {
        const id = r.id;
        const u = await executarAcao(() => marcarUrgente(id, true));
        if (!u.ok) toast.warning("A atividade foi criada, mas não foi marcada como urgente.", { description: u.error });
      }
      if (!r.ok) {
        let algum = false;
        for (const campo of CAMPOS) {
          const mensagem = r.fieldErrors?.[campo];
          if (mensagem) {
            setError(campo, { message: mensagem });
            algum = true;
          }
        }
        if (!algum) setError("root", { message: r.error });
        return;
      }
      toast.success(atividade ? "Atividade atualizada." : "Atividade criada.");
      onFechar();
    });
  });

  function arquivar() {
    if (!atividade) return;
    startTransition(async () => {
      const r = await executarAcao(() => arquivarAtividade(atividade.id));
      if (!r.ok) {
        setConfirmarArquivo(false);
        setError("root", { message: r.error });
        return;
      }
      setConfirmarArquivo(false);
      onFechar();
      toast.success("Atividade arquivada.", {
        action: {
          label: "Desfazer",
          onClick: async () => {
            const d = await executarAcao(() => restaurarAtividade(atividade.id));
            if (d.ok) toast.success("Atividade restaurada.");
            else toast.error(d.error);
          },
        },
      });
    });
  }

  const erro = (campo: Campo) => errors[campo]?.message;
  const descrito = (campo: string, mensagem?: string) => (mensagem ? `at-${campo}-erro` : undefined);

  const opcoesUsuarios = [
    { value: "", label: "Sem responsável" },
    ...usuarios.map((u) => ({
      value: u.id,
      label: nomeUsuario(u),
      descricao: u.nome ? u.email : undefined,
    })),
  ];

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
          <form id="form-atividade" onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="at-titulo">Título</Label>
            <Input
              id="at-titulo"
              autoComplete="off"
              maxLength={200}
              autoFocus={!atividade}
              aria-required
              aria-invalid={Boolean(erro("titulo"))}
              aria-describedby={descrito("titulo", erro("titulo"))}
              disabled={isPending}
              {...register("titulo")}
            />
            <MensagemErro id="at-titulo-erro" mensagem={erro("titulo")} />
          </div>

          {atividade ? (
            <CampoUrgente atividade={atividade} usuarios={usuarios} disabled={isPending} />
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <Label htmlFor="at-urgente" className="flex items-center gap-2">
                <SirenIcon className="size-4 text-etiqueta-vermelho-texto" aria-hidden />
                Urgente
              </Label>
              <Switch
                id="at-urgente"
                checked={urgenteNova}
                onCheckedChange={setUrgenteNova}
                disabled={isPending}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="at-prioridade">Prioridade</Label>
              <Controller
                control={control}
                name="prioridade"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "media"}
                    onValueChange={(v) => field.onChange(v as PrioridadeAtividade)}
                    disabled={isPending}
                  >
                    <SelectTrigger id="at-prioridade" ref={field.ref} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES_ATIVIDADE.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORIDADE_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="at-coluna">Coluna</Label>
              <Controller
                control={control}
                name="coluna_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isPending}>
                    <SelectTrigger
                      id="at-coluna"
                      ref={field.ref}
                      className="w-full"
                      aria-invalid={Boolean(erro("coluna_id"))}
                      aria-describedby={
                        erro("coluna_id") ? "at-coluna-erro at-coluna-ajuda" : "at-coluna-ajuda"
                      }
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {colunas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <AmostraCor cor={c.cor} />
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {atividade && (
                <p id="at-coluna-ajuda" className="text-xs text-muted-foreground">
                  Ao trocar, a atividade vai para o fim da coluna.
                </p>
              )}
              <MensagemErro id="at-coluna-erro" mensagem={erro("coluna_id")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="at-categorias">Categorias (opcional)</Label>
            <Controller
              control={control}
              name="categorias"
              render={({ field }) => (
                <CampoCategorias
                  id="at-categorias"
                  ref={field.ref}
                  categorias={categorias}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  disabled={isPending}
                  invalid={Boolean(erro("categorias"))}
                  descritoPor={descrito("categorias", erro("categorias"))}
                />
              )}
            />
            <MensagemErro id="at-categorias-erro" mensagem={erro("categorias")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="at-responsavel">Responsável (opcional)</Label>
              <Controller
                control={control}
                name="responsavel_id"
                render={({ field }) => (
                  <ComboboxLista
                    id="at-responsavel"
                    ref={field.ref}
                    opcoes={opcoesUsuarios}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Sem responsável"
                    placeholderBusca="Buscar usuário..."
                    vazio="Nenhum usuário encontrado."
                    disabled={isPending}
                    invalid={Boolean(erro("responsavel_id"))}
                    descritoPor={descrito("responsavel", erro("responsavel_id"))}
                  />
                )}
              />
              <MensagemErro id="at-responsavel-erro" mensagem={erro("responsavel_id")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="at-prazo">Prazo (opcional)</Label>
              <Controller
                control={control}
                name="prazo"
                render={({ field }) => (
                  <CampoData
                    id="at-prazo"
                    ref={field.ref}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    emitirInvalido
                    disabled={isPending}
                    invalid={Boolean(erro("prazo"))}
                    descritoPor={descrito("prazo", erro("prazo"))}
                  />
                )}
              />
              <MensagemErro id="at-prazo-erro" mensagem={erro("prazo")} />
            </div>
          </div>

          {errors.root?.message && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          </form>

          {/* Comentários: fora do formulário (têm envio próprio). */}
          {atividade && (
            <ComentariosAtividade
              atividadeId={atividade.id}
              usuarioId={usuarioId}
              usuarios={usuarios}
            />
          )}
        </div>

        <SheetFooter>
          {atividade && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmarArquivo(true)}
              disabled={isPending}
              className="sm:mr-auto"
            >
              <ArchiveIcon />
              Arquivar
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onFechar} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-atividade" disabled={isPending}>
            {isPending && <Carregando decorativo tamanho="sm" />}
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </SheetFooter>
      </div>

      <Dialog open={confirmarArquivo} onOpenChange={setConfirmarArquivo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar Atividade?</DialogTitle>
            <DialogDescription>
              Ela sai do quadro, mas continua guardada. Dá para restaurar em Atividades
              Arquivadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarArquivo(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={arquivar} disabled={isPending}>
              {isPending && <Carregando decorativo tamanho="sm" />}
              {isPending ? "Arquivando..." : "Arquivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * "Urgente" de uma atividade existente: grava na hora (não depende do
 * Salvar). Mostra quem marcou e quando.
 */
function CampoUrgente({
  atividade,
  usuarios,
  disabled,
}: {
  atividade: AtividadeQuadro;
  usuarios: UsuarioSistema[];
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const marcadoPor = atividade.urgente_por
    ? nomeUsuario(usuarios.find((u) => u.id === atividade.urgente_por))
    : null;

  function alternar(valor: boolean) {
    startTransition(async () => {
      const r = await executarAcao(() => marcarUrgente(atividade.id, valor));
      if (!r.ok) {
        toast.error("Não foi possível alterar \"Urgente\".", { description: r.error });
        return;
      }
      toast.success(valor ? "Marcada como urgente." : "Deixou de ser urgente.");
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="grid gap-0.5">
        <Label htmlFor="at-urgente" className="flex items-center gap-2">
          <SirenIcon className="size-4 text-etiqueta-vermelho-texto" aria-hidden />
          Urgente
        </Label>
        <p id="at-urgente-ajuda" className="text-xs text-muted-foreground">
          {atividade.urgente && atividade.urgente_em
            ? `Marcada${marcadoPor ? ` por ${marcadoPor}` : ""} em ${formatarDataHora(atividade.urgente_em)}.`
            : "Grava na hora, sem precisar salvar."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isPending && <Carregando rotulo="Salvando..." tamanho="sm" />}
        <Switch
          id="at-urgente"
          checked={atividade.urgente}
          onCheckedChange={alternar}
          disabled={disabled || isPending}
          aria-describedby="at-urgente-ajuda"
        />
      </div>
    </div>
  );
}
