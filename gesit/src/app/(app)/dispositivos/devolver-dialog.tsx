"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import type { ItemAnexo } from "@/components/campo-anexos";
import { CampoImagens } from "@/components/campo-imagens";
import { Carregando } from "@/components/carregando";
import { ComboboxLista } from "@/components/combobox-lista";
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
import { executarAcao } from "@/lib/executar-acao";
import { gravarImagens } from "@/lib/imagens-dispositivos";
import type { LojaOpcao } from "@/lib/lojas";
import { opcoesLojas } from "@/lib/opcoes-lojas";
import {
  PERIFERICOS_POR_TIPO,
  naoDevolvidos,
  ordenarPerifericos,
  rotulosPerifericos,
  temConferencia,
  type Periferico,
} from "@/lib/perifericos";
import {
  STATUS_DISPOSITIVO_LABEL,
  STATUS_SEM_BAIXA,
  ehStatusSemBaixa,
  type StatusSemBaixa,
  type TipoDispositivo,
} from "@/lib/types";

import { devolverDispositivo } from "./actions";
import { ConferenciaPerifericos } from "./conferencia-perifericos";

type Props = {
  dispositivo: { id: string; descricao: string; tipo: TipoDispositivo };
  /** Vínculo aberto: as imagens da devolução ficam ligadas a ele. */
  vinculoId: string;
  /** Para a filial de estoque após a devolução. */
  lojas: LojaOpcao[];
  /** Loja do vínculo encerrado: padrão da filial de estoque. */
  lojaVinculoId: string;
  colaboradorNome: string;
  /** perifericos_entrega do vínculo aberto. */
  perifericosEntregues: readonly string[];
  trigger: ReactNode;
};

export function DevolverDialog({
  dispositivo,
  vinculoId,
  lojas,
  lojaVinculoId,
  colaboradorNome,
  perifericosEntregues,
  trigger,
}: Props) {
  const conferencia = temConferencia(dispositivo.tipo);
  // Só os itens que valem para o tipo (o banco garante; aqui por segurança).
  const entregues = ordenarPerifericos(perifericosEntregues).filter((p) =>
    PERIFERICOS_POR_TIPO[dispositivo.tipo].includes(p),
  );

  const [open, setOpen] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [novoStatus, setNovoStatus] = useState<StatusSemBaixa>("disponivel");
  const [devolvidos, setDevolvidos] = useState<Periferico[]>(entregues);
  const [formatado, setFormatado] = useState(false);
  const [lojaEstoque, setLojaEstoque] = useState(lojaVinculoId);
  /** Já avisou dos itens não devolvidos e o usuário pode confirmar. */
  const [avisado, setAvisado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [imagens, setImagens] = useState<ItemAnexo[]>([]);
  const [etapa, setEtapa] = useState<string | null>(null);
  const imagensEnviadas = useRef(new Map<string, string>());

  const faltando = conferencia ? naoDevolvidos(entregues, devolvidos) : [];

  function onOpenChange(next: boolean) {
    if (isPending) return;
    if (next) {
      setObservacao("");
      setNovoStatus("disponivel");
      setDevolvidos(entregues);
      setFormatado(false);
      setLojaEstoque(lojaVinculoId);
      setAvisado(false);
      setErro(null);
      setImagens([]);
      setEtapa(null);
      imagensEnviadas.current = new Map();
    }
    setOpen(next);
  }

  function alterarDevolvidos(lista: Periferico[]) {
    setDevolvidos(lista);
    setAvisado(false); // mudou a conferência: avisa de novo, se ainda faltar algo
  }

  function salvar() {
    // Primeiro clique com pendência: mostra o aviso e pede confirmação.
    if (faltando.length > 0 && !avisado) {
      setAvisado(true);
      return;
    }

    startTransition(async () => {
      const result = await executarAcao(() =>
        devolverDispositivo({
          dispositivo_id: dispositivo.id,
          observacao,
          novo_status: novoStatus,
          perifericos_devolvidos: conferencia ? devolvidos : [],
          formatado: conferencia ? formatado : null,
          loja_estoque_id: lojaEstoque,
        }),
      );
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      toast.success(`Devolução de ${colaboradorNome} registrada.`);

      // Imagens do estado na devolução, ligadas ao vínculo agora encerrado.
      if (imagens.length > 0) {
        const erroImagens = await gravarImagens({
          dispositivoId: dispositivo.id,
          momento: "devolucao",
          vinculoId,
          itens: imagens,
          enviadas: imagensEnviadas.current,
          onProgresso: setEtapa,
        });
        setEtapa(null);
        if (erroImagens) {
          toast.warning("As imagens não foram gravadas.", {
            description: `${erroImagens} Adicione-as pelo detalhe do dispositivo.`,
            duration: 15000,
          });
        }
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
          <DialogDescription>
            {dispositivo.descricao} — encerra o vínculo com{" "}
            <strong>{colaboradorNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dev-status">Status após a devolução</Label>
            <Select
              value={novoStatus}
              onValueChange={(v) => {
                if (ehStatusSemBaixa(v)) setNovoStatus(v);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="dev-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_SEM_BAIXA.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_DISPOSITIVO_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Para dar baixa, registre a devolução e depois use Status &gt; Baixado.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dev-loja-estoque">Filial de estoque</Label>
            <ComboboxLista
              id="dev-loja-estoque"
              opcoes={opcoesLojas(lojas.filter((l) => l.ativo || l.id === lojaVinculoId))}
              value={lojaEstoque}
              onChange={setLojaEstoque}
              placeholderBusca="Buscar loja ou cidade..."
              vazio="Nenhuma loja encontrada."
              disabled={isPending}
              descritoPor="dev-loja-estoque-ajuda"
            />
            <p id="dev-loja-estoque-ajuda" className="text-xs text-muted-foreground">
              Onde o aparelho fica guardado depois da devolução. Padrão: a loja do vínculo.
            </p>
          </div>

          {conferencia && (
            <div className="grid gap-2">
              <ConferenciaPerifericos
                id="dev-perifericos"
                tipo={dispositivo.tipo}
                legenda="Periféricos devolvidos"
                selecionados={devolvidos}
                onSelecionadosChange={alterarDevolvidos}
                formatado={formatado}
                onFormatadoChange={setFormatado}
                rotuloFormatado="Formatado na devolução"
                entregues={entregues}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                {entregues.length > 0
                  ? `Entregues: ${rotulosPerifericos(entregues)}.`
                  : "Nenhum periférico registrado na entrega."}
              </p>
            </div>
          )}

          {avisado && faltando.length > 0 && (
            <p
              role="alert"
              className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-400"
            >
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                Itens não devolvidos: <strong>{rotulosPerifericos(faltando)}</strong>.
                Confirme para registrar a devolução assim mesmo.
              </span>
            </p>
          )}

          <CampoImagens
            id="dev-imagens"
            rotulo="Imagens do estado do item (opcional)"
            itens={imagens}
            onChange={setImagens}
            disabled={isPending}
          />

          <div className="grid gap-2">
            <Label htmlFor="dev-obs">Observação da devolução (opcional)</Label>
            <Textarea
              id="dev-obs"
              rows={3}
              maxLength={1000}
              placeholder="Ex.: tela com risco; mouse fica com o colaborador."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              disabled={isPending}
            />
          </div>

          {erro && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={isPending}>
            {isPending && <Carregando decorativo tamanho="sm" />}
            {isPending
              ? (etapa ?? "Salvando...")
              : avisado && faltando.length > 0
                ? "Confirmar devolução"
                : "Registrar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
