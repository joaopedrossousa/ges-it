"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Carregando } from "@/components/carregando";
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
  STATUS_EDITAVEIS,
  ehStatusEditavel,
  type StatusEditavel,
  type TipoDispositivo,
} from "@/lib/types";

import { devolverDispositivo } from "./actions";
import { ConferenciaPerifericos } from "./conferencia-perifericos";

type Props = {
  dispositivo: { id: string; descricao: string; tipo: TipoDispositivo };
  colaboradorNome: string;
  /** perifericos_entrega do vínculo aberto. */
  perifericosEntregues: readonly string[];
  trigger: ReactNode;
};

export function DevolverDialog({
  dispositivo,
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
  const [novoStatus, setNovoStatus] = useState<StatusEditavel>("disponivel");
  const [devolvidos, setDevolvidos] = useState<Periferico[]>(entregues);
  const [formatado, setFormatado] = useState(false);
  /** Já avisou dos itens não devolvidos e o usuário pode confirmar. */
  const [avisado, setAvisado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const faltando = conferencia ? naoDevolvidos(entregues, devolvidos) : [];

  function onOpenChange(next: boolean) {
    if (isPending) return;
    if (next) {
      setObservacao("");
      setNovoStatus("disponivel");
      setDevolvidos(entregues);
      setFormatado(false);
      setAvisado(false);
      setErro(null);
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
        }),
      );
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      toast.success(`Devolução de ${colaboradorNome} registrada.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar devolução</DialogTitle>
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
                if (ehStatusEditavel(v)) setNovoStatus(v);
              }}
              disabled={isPending}
            >
              <SelectTrigger id="dev-status" className="w-full">
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

          <div className="grid gap-2">
            <Label htmlFor="dev-obs">Observação da devolução (opcional)</Label>
            <Textarea
              id="dev-obs"
              rows={3}
              maxLength={1000}
              placeholder="Ex.: tela com risco; mouse fica com o usuário."
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
              ? "Salvando..."
              : avisado && faltando.length > 0
                ? "Confirmar devolução"
                : "Registrar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
