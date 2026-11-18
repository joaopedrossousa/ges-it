"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { CampoAnexos, type ItemAnexo } from "@/components/campo-anexos";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ANEXO_BAIXA_ACCEPT,
  ANEXOS_BAIXA_MAXIMO,
  enviarAnexoBaixa,
  validarArquivoBaixa,
} from "@/lib/anexos-baixa";
import { executarAcao } from "@/lib/executar-acao";
import { hojeEmPalmas } from "@/lib/format";
import {
  MOTIVOS_BAIXA,
  MOTIVO_BAIXA_LABEL,
  STATUS_DISPOSITIVO_LABEL,
  STATUS_EDITAVEIS,
  ehMotivoBaixa,
  ehStatusEditavel,
  ehStatusSemBaixa,
  type MotivoBaixa,
  type StatusDispositivo,
} from "@/lib/types";
import { baixaSchema } from "@/lib/validators";

import { alterarStatusDispositivo, baixarDispositivo } from "./actions";

type Props = {
  dispositivo: {
    id: string;
    descricao: string;
    status: StatusDispositivo;
    /** Preenchido quando há vínculo aberto. */
    colaboradorNome: string | null;
    /** Já tem registro de baixa: não sai de "Baixado" (migration 019). */
    baixaRegistrada?: boolean;
    /** A data da baixa não pode ser anterior à compra. */
    dataCompra?: string | null;
  };
  trigger: ReactNode;
};

type CampoBaixa = "motivo" | "informacoes" | "data_baixa";
type ErrosBaixa = Partial<Record<CampoBaixa, string>>;

/**
 * Status do dispositivo. Disponível e manutenção salvam direto; "Baixado"
 * abre o formulário obrigatório de baixa (motivo, informações, data e
 * anexos), gravado por baixar_dispositivo.
 */
export function StatusDialog({ dispositivo, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState<StatusDispositivo>(dispositivo.status);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [etapa, setEtapa] = useState<string | null>(null);

  // Formulário de baixa
  const [motivo, setMotivo] = useState<MotivoBaixa | "">("");
  const [informacoes, setInformacoes] = useState("");
  const [dataBaixa, setDataBaixa] = useState("");
  const [anexos, setAnexos] = useState<ItemAnexo[]>([]);
  const [errosBaixa, setErrosBaixa] = useState<ErrosBaixa>({});
  // Anexos já enviados (chave do item → caminho): tentar de novo não reenvia.
  const enviados = useRef(new Map<string, string>());

  const vinculado =
    Boolean(dispositivo.colaboradorNome) || dispositivo.status === "em_uso";
  const baixaDefinitiva = dispositivo.status === "baixado" && dispositivo.baixaRegistrada;
  const darBaixa = novo === "baixado" && dispositivo.status !== "baixado";
  const bloqueado = vinculado || baixaDefinitiva;

  function onOpenChange(next: boolean) {
    if (isPending) return;
    if (next) {
      setNovo(dispositivo.status);
      setErro(null);
      setMotivo("");
      setInformacoes("");
      setDataBaixa(hojeEmPalmas());
      setAnexos([]);
      setErrosBaixa({});
      enviados.current = new Map();
    }
    setOpen(next);
  }

  function salvarStatus() {
    if (!ehStatusSemBaixa(novo)) return;
    const escolhido = novo;
    startTransition(async () => {
      const result = await executarAcao(() =>
        alterarStatusDispositivo(dispositivo.id, escolhido),
      );
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      toast.success(`Status alterado para "${STATUS_DISPOSITIVO_LABEL[escolhido]}".`);
      setOpen(false);
    });
  }

  function salvarBaixa() {
    setErro(null);
    const parsed = baixaSchema.safeParse({
      dispositivo_id: dispositivo.id,
      motivo,
      informacoes,
      data_baixa: dataBaixa,
      anexos: [],
    });
    const erros: ErrosBaixa = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const campo = issue.path[0] as CampoBaixa;
        erros[campo] ??= issue.message;
      }
    }
    if (dispositivo.dataCompra && dataBaixa && dataBaixa < dispositivo.dataCompra) {
      erros.data_baixa ??= "A data da baixa não pode ser anterior à data de compra.";
    }
    setErrosBaixa(erros);
    if (!parsed.success || Object.keys(erros).length > 0) return;

    startTransition(async () => {
      // 1. Anexos direto do navegador para o bucket "baixas".
      const lista: { path: string; nome: string }[] = [];
      for (const [i, item] of anexos.entries()) {
        let path = enviados.current.get(item.chave);
        if (!path) {
          setEtapa(`Enviando anexos (${i + 1} de ${anexos.length})...`);
          const envio = await enviarAnexoBaixa(dispositivo.id, item.arquivo);
          if ("erro" in envio) {
            setEtapa(null);
            setErro(envio.erro);
            return;
          }
          path = envio.path;
          enviados.current.set(item.chave, path);
        }
        lista.push({ path, nome: item.arquivo.name });
      }

      // 2. Baixa (status, registro e anexos numa transação).
      setEtapa("Salvando...");
      const result = await executarAcao(() =>
        baixarDispositivo({ ...parsed.data, anexos: lista }),
      );
      setEtapa(null);
      if (!result.ok) {
        setErro(result.error);
        if (result.fieldErrors) setErrosBaixa(result.fieldErrors as ErrosBaixa);
        return;
      }
      toast.success("Baixa registrada.");
      setOpen(false);
    });
  }

  const ocupado = isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={darBaixa ? "max-h-[90vh] overflow-y-auto sm:max-w-lg" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{darBaixa ? "Baixa do Dispositivo" : "Alterar Status"}</DialogTitle>
          <DialogDescription>{dispositivo.descricao}</DialogDescription>
        </DialogHeader>

        {vinculado ? (
          <p
            role="alert"
            className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-400"
          >
            Este dispositivo está vinculado a{" "}
            <strong>{dispositivo.colaboradorNome ?? "um colaborador"}</strong>. Faça a
            devolução antes de alterar o status.
          </p>
        ) : baixaDefinitiva ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Este dispositivo foi baixado pelo formulário de baixa e não pode ser reativado.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="disp-status">Novo status</Label>
              <Select
                value={novo}
                onValueChange={(v) => {
                  if (ehStatusEditavel(v)) {
                    setNovo(v);
                    setErro(null);
                  }
                }}
                disabled={ocupado}
              >
                <SelectTrigger
                  id="disp-status"
                  className="w-full"
                  aria-describedby={erro ? "disp-status-erro" : undefined}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_EDITAVEIS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_DISPOSITIVO_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {darBaixa && (
              <>
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-400">
                  A baixa é definitiva: o dispositivo não poderá voltar a ser usado.
                </p>

                <div className="grid gap-2">
                  <Label htmlFor="baixa-motivo">Motivo</Label>
                  <Select
                    value={motivo}
                    onValueChange={(v) => {
                      if (ehMotivoBaixa(v)) setMotivo(v);
                    }}
                    disabled={ocupado}
                  >
                    <SelectTrigger
                      id="baixa-motivo"
                      className="w-full"
                      aria-required
                      aria-invalid={Boolean(errosBaixa.motivo)}
                      aria-describedby={errosBaixa.motivo ? "baixa-motivo-erro" : undefined}
                    >
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_BAIXA.map((m) => (
                        <SelectItem key={m} value={m}>
                          {MOTIVO_BAIXA_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <MensagemErro id="baixa-motivo-erro" mensagem={errosBaixa.motivo} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="baixa-informacoes">Informações da baixa</Label>
                  <Textarea
                    id="baixa-informacoes"
                    rows={3}
                    maxLength={2000}
                    placeholder="Ex.: Telefone roubado em 10/11/2026, boletim de ocorrência nº ..."
                    value={informacoes}
                    onChange={(e) => setInformacoes(e.target.value)}
                    disabled={ocupado}
                    aria-required
                    aria-invalid={Boolean(errosBaixa.informacoes)}
                    aria-describedby={errosBaixa.informacoes ? "baixa-informacoes-erro" : undefined}
                  />
                  <MensagemErro id="baixa-informacoes-erro" mensagem={errosBaixa.informacoes} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="baixa-data">Data da baixa</Label>
                  <CampoData
                    id="baixa-data"
                    value={dataBaixa}
                    onChange={setDataBaixa}
                    emitirInvalido
                    min={dispositivo.dataCompra ?? undefined}
                    max={hojeEmPalmas()}
                    required
                    disabled={ocupado}
                    invalid={Boolean(errosBaixa.data_baixa)}
                    descritoPor={errosBaixa.data_baixa ? "baixa-data-erro" : undefined}
                  />
                  <MensagemErro id="baixa-data-erro" mensagem={errosBaixa.data_baixa} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="baixa-anexos">Anexos (opcional)</Label>
                  <CampoAnexos
                    id="baixa-anexos"
                    itens={anexos}
                    onChange={setAnexos}
                    accept={ANEXO_BAIXA_ACCEPT}
                    validar={validarArquivoBaixa}
                    maximo={ANEXOS_BAIXA_MAXIMO}
                    disabled={ocupado}
                    descritoPor="baixa-anexos-ajuda"
                  />
                  <p id="baixa-anexos-ajuda" className="text-xs text-muted-foreground">
                    Ex.: boletim de ocorrência, laudo, fotos. Imagens JPG, PNG ou WebP e PDF, até
                    10 MB cada.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {erro && (
          <p
            id="disp-status-erro"
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {erro}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={ocupado}
          >
            {bloqueado ? "Fechar" : "Cancelar"}
          </Button>
          {!bloqueado && (
            <Button
              type="button"
              variant={darBaixa ? "destructive" : "default"}
              onClick={darBaixa ? salvarBaixa : salvarStatus}
              disabled={ocupado || novo === dispositivo.status}
            >
              {ocupado && <Carregando decorativo tamanho="sm" />}
              {ocupado ? (etapa ?? "Salvando...") : darBaixa ? "Registrar baixa" : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
