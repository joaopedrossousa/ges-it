"use client";

import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Combobox, type OpcaoCombobox } from "@/components/combobox";
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
import { Textarea } from "@/components/ui/textarea";
import type { ColaboradorOpcao } from "@/lib/colaboradores";
import type { DispositivoOpcao } from "@/lib/dispositivos-vinculaveis";
import { enviarTermo, validarArquivoTermo } from "@/lib/termos";
import { STATUS_DISPOSITIVO_LABEL, TIPO_DISPOSITIVO_LABEL } from "@/lib/types";

import { vincularDispositivo } from "./actions";

type Props = {
  /** Só status disponível/em uso (ver listarDispositivosVinculaveis). */
  dispositivos: DispositivoOpcao[];
  /** Só colaboradores ativos (ver listarColaboradoresAtivos). */
  colaboradores: ColaboradorOpcao[];
  /** Pré-seleção ao abrir pelo detalhe do dispositivo. */
  dispositivoInicialId?: string;
  /** Pré-seleção ao abrir pelo detalhe do colaborador. */
  colaboradorInicialId?: string;
  trigger: ReactNode;
};

type Erros = Partial<Record<"dispositivo" | "colaborador" | "termo" | "geral", string>>;

/** PDF já enviado nesta abertura do diálogo (reaproveitado numa nova tentativa). */
type Enviado = {
  path: string;
  arquivo: File;
  dispositivoId: string;
  colaboradorId: string;
};

/**
 * Vincular dispositivo — usado para vincular e para transferir.
 * Fluxo: valida → envia o PDF do navegador para o bucket "termos" →
 * Server Action chama rpc("vincular_dispositivo") com o termo_path.
 */
export function VincularDialog({
  dispositivos,
  colaboradores,
  dispositivoInicialId,
  colaboradorInicialId,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dispositivoId, setDispositivoId] = useState<string | null>(null);
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [orfao, setOrfao] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<Enviado | null>(null);
  const [etapa, setEtapa] = useState<"enviando" | "salvando" | null>(null);
  const [, startTransition] = useTransition();
  const ocupado = etapa !== null;

  const dispositivo = dispositivos.find((d) => d.id === dispositivoId) ?? null;
  const usuarioAtual = dispositivo?.colaborador_id
    ? { id: dispositivo.colaborador_id, nome: dispositivo.colaborador_nome ?? "usuário atual" }
    : null;

  const opcoesDispositivo = useMemo<OpcaoCombobox[]>(
    () =>
      dispositivos.map((d) => ({
        value: d.id,
        label: `${d.marca} ${d.modelo} · ${d.identificador}`,
        descricao: `${TIPO_DISPOSITIVO_LABEL[d.tipo]} · ${
          d.colaborador_nome
            ? `com ${d.colaborador_nome}`
            : STATUS_DISPOSITIVO_LABEL[d.status]
        }`,
        busca: d.busca,
      })),
    [dispositivos],
  );

  // O usuário atual do dispositivo não pode receber o mesmo dispositivo.
  const opcoesColaborador = useMemo<OpcaoCombobox[]>(
    () =>
      colaboradores
        .filter((c) => c.id !== usuarioAtual?.id)
        .map((c) => ({
          value: c.id,
          label: c.nome,
          descricao: `${c.loja_nome ?? "—"} · ${c.email}`,
          busca: `${c.email} ${c.loja_nome ?? ""}`,
        })),
    [colaboradores, usuarioAtual?.id],
  );

  function onOpenChange(next: boolean) {
    if (ocupado) return;
    if (next) {
      const inicial = dispositivos.some((d) => d.id === dispositivoInicialId)
        ? dispositivoInicialId!
        : null;
      setDispositivoId(inicial);
      setColaboradorId(
        colaboradores.some((c) => c.id === colaboradorInicialId)
          ? colaboradorInicialId!
          : null,
      );
      setArquivo(null);
      setObservacao("");
      setErros({});
      setOrfao(null);
      setEnviado(null);
    }
    setOpen(next);
  }

  function escolherDispositivo(id: string) {
    setDispositivoId(id);
    setErros((e) => ({ ...e, dispositivo: undefined }));
    // Se o colaborador escolhido é o usuário atual do novo dispositivo, limpa.
    const novo = dispositivos.find((d) => d.id === id);
    if (novo?.colaborador_id && novo.colaborador_id === colaboradorId) {
      setColaboradorId(null);
    }
  }

  function salvar() {
    const erroArquivo = validarArquivoTermo(arquivo);
    const novosErros: Erros = {
      dispositivo: dispositivoId ? undefined : "Selecione o dispositivo.",
      colaborador: colaboradorId ? undefined : "Selecione o colaborador.",
      termo: erroArquivo ?? undefined,
    };
    if (!dispositivoId || !colaboradorId || erroArquivo) {
      setErros(novosErros);
      return;
    }
    setErros({});
    setOrfao(null);

    startTransition(async () => {
      let termoPath: string | null = null;

      if (arquivo) {
        const reaproveitar =
          enviado &&
          enviado.arquivo === arquivo &&
          enviado.dispositivoId === dispositivoId &&
          enviado.colaboradorId === colaboradorId;

        if (reaproveitar) {
          termoPath = enviado.path;
        } else {
          setEtapa("enviando");
          const envio = await enviarTermo(dispositivoId, colaboradorId, arquivo);
          if ("erro" in envio) {
            setEtapa(null);
            setErros({ termo: envio.erro });
            return;
          }
          termoPath = envio.path;
          setEnviado({ path: envio.path, arquivo, dispositivoId, colaboradorId });
        }
      }

      setEtapa("salvando");
      const result = await vincularDispositivo({
        dispositivo_id: dispositivoId,
        colaborador_id: colaboradorId,
        termo_path: termoPath,
        observacao,
      });
      setEtapa(null);

      if (!result.ok) {
        setErros({
          colaborador: result.fieldErrors?.colaborador_id,
          termo: result.fieldErrors?.termo_path,
          geral: result.error,
        });
        // O PDF já está no Storage; não apagamos (o bucket não permite e
        // o arquivo pode ser reaproveitado numa nova tentativa).
        if (termoPath) setOrfao(termoPath);
        return;
      }

      const nome = colaboradores.find((c) => c.id === colaboradorId)?.nome;
      toast.success(
        usuarioAtual
          ? `Dispositivo transferido para ${nome}.`
          : `Dispositivo vinculado a ${nome}.`,
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular dispositivo</DialogTitle>
          <DialogDescription>
            Entregue um dispositivo a um colaborador, com o termo de responsabilidade.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="vinc-dispositivo">Dispositivo</Label>
            <Combobox
              id="vinc-dispositivo"
              opcoes={opcoesDispositivo}
              value={dispositivoId}
              onChange={escolherDispositivo}
              placeholder="Selecione o dispositivo"
              placeholderBusca="Marca, modelo, serial ou IMEI"
              vazio="Nenhum dispositivo disponível ou em uso."
              disabled={ocupado}
              invalid={Boolean(erros.dispositivo)}
            />
            {erros.dispositivo && (
              <p className="text-sm text-destructive">{erros.dispositivo}</p>
            )}
          </div>

          {usuarioAtual && (
            <p
              role="status"
              className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-400"
            >
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                O vínculo com <strong>{usuarioAtual.nome}</strong> será encerrado e irá
                para o histórico.
              </span>
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="vinc-colaborador">Colaborador</Label>
            <Combobox
              id="vinc-colaborador"
              opcoes={opcoesColaborador}
              value={colaboradorId}
              onChange={(id) => {
                setColaboradorId(id);
                setErros((e) => ({ ...e, colaborador: undefined }));
              }}
              placeholder="Selecione o colaborador"
              placeholderBusca="Nome, e-mail ou loja"
              vazio="Nenhum colaborador ativo encontrado."
              disabled={ocupado}
              invalid={Boolean(erros.colaborador)}
            />
            {erros.colaborador && (
              <p className="text-sm text-destructive">{erros.colaborador}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vinc-termo">Termo de responsabilidade (PDF, até 5 MB)</Label>
            <Input
              id="vinc-termo"
              type="file"
              accept="application/pdf,.pdf"
              disabled={ocupado}
              aria-invalid={Boolean(erros.termo)}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setArquivo(f);
                setErros((atual) => ({ ...atual, termo: validarArquivoTermo(f) ?? undefined }));
              }}
            />
            {erros.termo && <p className="text-sm text-destructive">{erros.termo}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vinc-obs">Observação</Label>
            <Textarea
              id="vinc-obs"
              rows={2}
              maxLength={1000}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              disabled={ocupado}
            />
          </div>

          {erros.geral && (
            <div
              role="alert"
              className="grid gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <p className="flex gap-2 font-medium">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                {erros.geral}
              </p>
              {orfao && (
                <p>
                  O PDF foi enviado ao Storage, mas o vínculo não foi salvo: o arquivo
                  ficou órfão em <code className="break-all">termos/{orfao}</code>. Ele
                  não foi apagado; ao tentar de novo com o mesmo arquivo, dispositivo e
                  colaborador, ele será reaproveitado.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={ocupado}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={ocupado}>
            {etapa === "enviando"
              ? "Enviando termo..."
              : etapa === "salvando"
                ? "Salvando..."
                : usuarioAtual
                  ? "Transferir"
                  : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
