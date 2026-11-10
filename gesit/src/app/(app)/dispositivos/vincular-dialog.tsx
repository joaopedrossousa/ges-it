"use client";

import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { ComboboxBusca, type OpcaoCombobox } from "@/components/combobox";
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
import type { ColaboradorOpcao, DispositivoOpcao } from "@/lib/opcoes-vinculo";
import { enviarTermo, validarArquivoTermo } from "@/lib/termos";
import { STATUS_DISPOSITIVO_LABEL, TIPO_DISPOSITIVO_LABEL } from "@/lib/types";

import { vincularDispositivo } from "./actions";

type Props = {
  /** Pré-seleção ao abrir pelo detalhe do dispositivo. */
  dispositivoInicial?: DispositivoOpcao;
  /** Pré-seleção ao abrir pelo detalhe do colaborador. */
  colaboradorInicial?: ColaboradorOpcao;
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

// ---------------------------------------------------------------------------
// Busca no servidor (Route Handlers /api/busca/*)
// ---------------------------------------------------------------------------

async function buscarItens<T>(url: string, signal: AbortSignal): Promise<T[]> {
  const res = await fetch(url, {
    signal,
    redirect: "manual", // sem sessão o proxy redireciona para /login
    headers: { Accept: "application/json" },
  });
  if (res.type === "opaqueredirect" || res.status === 401) {
    throw new Error("Sua sessão expirou. Recarregue a página e entre novamente.");
  }
  if (!res.ok) throw new Error("Não foi possível buscar. Tente novamente.");
  const json = (await res.json()) as { itens: T[] };
  return json.itens;
}

function opcaoDispositivo(d: DispositivoOpcao): OpcaoCombobox<DispositivoOpcao> {
  return {
    value: d.id,
    label: `${d.marca} ${d.modelo} · ${d.identificador}`,
    descricao: `${TIPO_DISPOSITIVO_LABEL[d.tipo]} · ${
      d.colaborador_nome ? `com ${d.colaborador_nome}` : STATUS_DISPOSITIVO_LABEL[d.status]
    }`,
    dados: d,
  };
}

function opcaoColaborador(c: ColaboradorOpcao): OpcaoCombobox<ColaboradorOpcao> {
  return {
    value: c.id,
    label: c.nome,
    descricao: `${c.loja_nome ?? "—"} · ${c.email}`,
    dados: c,
  };
}

// ---------------------------------------------------------------------------

/**
 * Vincular dispositivo — usado para vincular e para transferir.
 * Fluxo: valida → envia o PDF do navegador para o bucket "termos" →
 * Server Action chama rpc("vincular_dispositivo") com o termo_path.
 */
export function VincularDialog({ dispositivoInicial, colaboradorInicial, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [dispositivo, setDispositivo] = useState<OpcaoCombobox<DispositivoOpcao> | null>(null);
  const [colaborador, setColaborador] = useState<OpcaoCombobox<ColaboradorOpcao> | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [orfao, setOrfao] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<Enviado | null>(null);
  const [etapa, setEtapa] = useState<"enviando" | "salvando" | null>(null);
  const [, startTransition] = useTransition();
  const ocupado = etapa !== null;

  const usuarioAtual = dispositivo?.dados.colaborador_id
    ? {
        id: dispositivo.dados.colaborador_id,
        nome: dispositivo.dados.colaborador_nome ?? "usuário atual",
      }
    : null;

  function onOpenChange(next: boolean) {
    if (ocupado) return;
    if (next) {
      setDispositivo(dispositivoInicial ? opcaoDispositivo(dispositivoInicial) : null);
      setColaborador(colaboradorInicial ? opcaoColaborador(colaboradorInicial) : null);
      setArquivo(null);
      setObservacao("");
      setErros({});
      setOrfao(null);
      setEnviado(null);
    }
    setOpen(next);
  }

  function escolherDispositivo(opcao: OpcaoCombobox<DispositivoOpcao>) {
    setDispositivo(opcao);
    setErros((e) => ({ ...e, dispositivo: undefined }));
    // O usuário atual do dispositivo não pode recebê-lo de novo.
    if (opcao.dados.colaborador_id && opcao.dados.colaborador_id === colaborador?.value) {
      setColaborador(null);
    }
  }

  function salvar() {
    const erroArquivo = validarArquivoTermo(arquivo);
    if (!dispositivo || !colaborador || erroArquivo) {
      setErros({
        dispositivo: dispositivo ? undefined : "Selecione o dispositivo.",
        colaborador: colaborador ? undefined : "Selecione o colaborador.",
        termo: erroArquivo ?? undefined,
      });
      return;
    }
    const dispositivoId = dispositivo.value;
    const colaboradorId = colaborador.value;
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

      toast.success(
        usuarioAtual
          ? `Dispositivo transferido para ${colaborador.label}.`
          : `Dispositivo vinculado a ${colaborador.label}.`,
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
            <ComboboxBusca
              id="vinc-dispositivo"
              value={dispositivo}
              onChange={escolherDispositivo}
              buscar={async (termo, signal) =>
                (
                  await buscarItens<DispositivoOpcao>(
                    `/api/busca/dispositivos?q=${encodeURIComponent(termo)}`,
                    signal,
                  )
                ).map(opcaoDispositivo)
              }
              placeholder="Selecione o dispositivo"
              placeholderBusca="Marca, modelo, serial, IMEI ou usuário"
              vazio="Nenhum dispositivo disponível ou em uso encontrado."
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
            <ComboboxBusca
              // Remonta ao trocar de dispositivo: a exclusão do usuário atual muda.
              key={usuarioAtual?.id ?? "sem-usuario"}
              id="vinc-colaborador"
              value={colaborador}
              onChange={(opcao) => {
                setColaborador(opcao);
                setErros((e) => ({ ...e, colaborador: undefined }));
              }}
              buscar={async (termo, signal) => {
                const params = new URLSearchParams({ q: termo });
                if (usuarioAtual) params.set("excluir", usuarioAtual.id);
                return (
                  await buscarItens<ColaboradorOpcao>(
                    `/api/busca/colaboradores?${params}`,
                    signal,
                  )
                ).map(opcaoColaborador);
              }}
              placeholder="Selecione o colaborador"
              placeholderBusca="Nome ou e-mail"
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
