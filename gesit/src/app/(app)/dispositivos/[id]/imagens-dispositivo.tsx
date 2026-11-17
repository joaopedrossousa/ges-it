"use client";

import { ImagePlusIcon, ImagesIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type { ItemAnexo } from "@/components/campo-anexos";
import { CampoImagens } from "@/components/campo-imagens";
import { Carregando } from "@/components/carregando";
import { GaleriaAnexos } from "@/components/galeria-anexos";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { executarAcao } from "@/lib/executar-acao";
import { gravarImagens } from "@/lib/imagens-dispositivos";
import {
  MOMENTOS_IMAGEM,
  MOMENTOS_SEM_VINCULO,
  MOMENTO_IMAGEM_LABEL,
  type MomentoImagem,
} from "@/lib/types";

import { removerImagemDispositivo } from "../actions";

/** Imagem já gravada (não removida), pronta para a galeria. */
export type ImagemDispositivo = {
  id: string;
  momento: MomentoImagem;
  legenda: string | null;
  /** Ex.: "Maria Souza · 17/11/2026 14:30 · ti@empresa.com". */
  detalhe: string;
};

type Props = {
  dispositivoId: string;
  imagens: ImagemDispositivo[];
  /** Falso para dispositivo baixado (não aceita imagens novas; migration 021). */
  podeAdicionar: boolean;
};

/**
 * Seção "Imagens" do detalhe: galeria agrupada por momento (cadastro,
 * entrega, transferência, devolução, outro). Clicar amplia; remover pede
 * confirmação e só marca a imagem como removida (fica no log).
 */
export function ImagensDispositivo({ dispositivoId, imagens, podeAdicionar }: Props) {
  const [removendo, setRemovendo] = useState<ImagemDispositivo | null>(null);
  const [isPending, startTransition] = useTransition();

  const grupos = MOMENTOS_IMAGEM.map((momento) => ({
    momento,
    itens: imagens.filter((i) => i.momento === momento),
  })).filter((g) => g.itens.length > 0);

  function confirmarRemocao() {
    if (!removendo) return;
    const alvo = removendo;
    startTransition(async () => {
      const result = await executarAcao(() => removerImagemDispositivo(alvo.id));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Imagem removida.");
      setRemovendo(null);
    });
  }

  return (
    <Card id="imagens" className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagesIcon className="size-4 text-muted-foreground" aria-hidden />
          Imagens
        </CardTitle>
        <CardDescription>
          {imagens.length === 0
            ? "Nenhuma imagem do estado do item."
            : `${imagens.length} ${imagens.length === 1 ? "imagem" : "imagens"} do estado do item, por momento.`}
          {!podeAdicionar && " Dispositivo baixado: não aceita imagens novas."}
        </CardDescription>
        {podeAdicionar && (
          <CardAction>
            <AdicionarImagens dispositivoId={dispositivoId} />
          </CardAction>
        )}
      </CardHeader>
      {grupos.length > 0 && (
        <CardContent className="grid gap-5">
          {grupos.map((g) => (
            <section key={g.momento} aria-labelledby={`imagens-${g.momento}`} className="grid gap-2">
              <h3 id={`imagens-${g.momento}`} className="text-sm font-medium">
                {MOMENTO_IMAGEM_LABEL[g.momento]}{" "}
                <span className="font-normal text-muted-foreground">({g.itens.length})</span>
              </h3>
              <GaleriaAnexos
                rotulo={`Imagens: ${MOMENTO_IMAGEM_LABEL[g.momento]}`}
                tamanho="md"
                itens={g.itens.map((i) => ({
                  chave: i.id,
                  nome: i.legenda ?? "Sem legenda",
                  legenda: i.legenda ?? undefined,
                  detalhe: i.detalhe,
                  tipo: "imagem",
                  url: `/api/imagens-dispositivos?id=${i.id}`,
                }))}
                onRemover={(chave) => setRemovendo(imagens.find((i) => i.id === chave) ?? null)}
                disabled={isPending}
              />
            </section>
          ))}
        </CardContent>
      )}

      <Dialog open={removendo !== null} onOpenChange={(abrir) => !abrir && !isPending && setRemovendo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover Imagem</DialogTitle>
            <DialogDescription>
              {removendo?.legenda ? `"${removendo.legenda}" — ` : ""}a imagem sai da galeria, mas
              a remoção fica registrada no log de auditoria. Use para imagens enviadas por engano.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemovendo(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={confirmarRemocao} disabled={isPending}>
              {isPending && <Carregando decorativo tamanho="sm" />}
              {isPending ? "Removendo..." : "Remover imagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

type MomentoSemVinculo = (typeof MOMENTOS_SEM_VINCULO)[number];

/** Imagens avulsas (cadastro ou outro); as de uso vêm dos diálogos de vínculo. */
function AdicionarImagens({ dispositivoId }: { dispositivoId: string }) {
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState<ItemAnexo[]>([]);
  const [momento, setMomento] = useState<MomentoSemVinculo>("cadastro");
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const enviadas = useRef(new Map<string, string>());

  function onOpenChange(next: boolean) {
    if (isPending) return;
    if (next) {
      setItens([]);
      setMomento("cadastro");
      setErro(null);
      setEtapa(null);
      enviadas.current = new Map();
    }
    setOpen(next);
  }

  function salvar() {
    if (itens.length === 0) {
      setErro("Escolha, arraste ou cole ao menos uma imagem.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const resultado = await gravarImagens({
        dispositivoId,
        momento,
        itens,
        enviadas: enviadas.current,
        onProgresso: setEtapa,
      });
      setEtapa(null);
      if (resultado) {
        setErro(resultado);
        return;
      }
      toast.success(itens.length === 1 ? "Imagem adicionada." : "Imagens adicionadas.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        <ImagePlusIcon />
        Adicionar imagens
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Imagens</DialogTitle>
          <DialogDescription>
            Imagens do estado do item. As de entrega, transferência e devolução são enviadas nos
            próprios diálogos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2 sm:max-w-56">
            <Label htmlFor="add-imagens-momento">Momento</Label>
            <Select
              value={momento}
              onValueChange={(v) => {
                const m = MOMENTOS_SEM_VINCULO.find((x) => x === v);
                if (m) setMomento(m);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="add-imagens-momento" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOMENTOS_SEM_VINCULO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOMENTO_IMAGEM_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CampoImagens
            id="add-imagens"
            rotulo="Imagens"
            itens={itens}
            onChange={setItens}
            disabled={isPending}
          />
          {erro && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={isPending}>
            {isPending && <Carregando decorativo tamanho="sm" />}
            {isPending ? (etapa ?? "Salvando...") : "Salvar imagens"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
