"use client";

import { cn } from "cn";
import { CheckIcon, SearchIcon } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { ColaboradorOpcao } from "@/lib/colaboradores";
import { enviarTermo, validarArquivoTermo as validarArquivo } from "@/lib/termos";

import { vincularDispositivo } from "./actions";

const MAX_RESULTADOS = 50;

type Props = {
  modo: "vincular" | "transferir";
  dispositivo: { id: string; descricao: string };
  colaboradores: ColaboradorOpcao[];
  /** Usuário atual (fica fora da lista na transferência). */
  colaboradorAtualId?: string;
  trigger: ReactNode;
};

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function VincularDialog({
  modo,
  dispositivo,
  colaboradores,
  colaboradorAtualId,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<Partial<Record<"colaborador_id" | "termo_path" | "geral", string>>>({});
  const [etapa, setEtapa] = useState<"enviando" | "salvando" | null>(null);
  const [, startTransition] = useTransition();
  const ocupado = etapa !== null;

  const opcoes = useMemo(() => {
    const termo = normalizar(busca.trim());
    return colaboradores
      .filter((c) => c.id !== colaboradorAtualId)
      .filter(
        (c) =>
          !termo ||
          normalizar(`${c.nome} ${c.email} ${c.loja_nome ?? ""}`).includes(termo),
      );
  }, [busca, colaboradores, colaboradorAtualId]);

  const selecionado = colaboradores.find((c) => c.id === colaboradorId);

  function onOpenChange(next: boolean) {
    if (ocupado) return;
    if (next) {
      setBusca("");
      setColaboradorId(null);
      setArquivo(null);
      setObservacao("");
      setErros({});
    }
    setOpen(next);
  }

  function salvar() {
    const erroArquivo = validarArquivo(arquivo);
    if (!colaboradorId || erroArquivo) {
      setErros({
        colaborador_id: colaboradorId ? undefined : "Selecione o usuário.",
        termo_path: erroArquivo ?? undefined,
      });
      return;
    }
    setErros({});

    startTransition(async () => {
      let termoPath: string | null = null;

      if (arquivo) {
        setEtapa("enviando");
        const envio = await enviarTermo(dispositivo.id, arquivo);
        if ("erro" in envio) {
          setEtapa(null);
          setErros({ termo_path: envio.erro });
          return;
        }
        termoPath = envio.path;
      }

      setEtapa("salvando");
      const result = await vincularDispositivo({
        dispositivo_id: dispositivo.id,
        colaborador_id: colaboradorId,
        termo_path: termoPath,
        observacao,
      });
      setEtapa(null);

      if (!result.ok) {
        setErros({
          colaborador_id: result.fieldErrors?.colaborador_id,
          termo_path: result.fieldErrors?.termo_path,
          geral: result.fieldErrors ? undefined : result.error,
        });
        return;
      }

      toast.success(
        modo === "transferir"
          ? `Dispositivo transferido para ${selecionado?.nome}.`
          : `Dispositivo vinculado a ${selecionado?.nome}.`,
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modo === "transferir" ? "Transferir dispositivo" : "Vincular dispositivo"}
          </DialogTitle>
          <DialogDescription>
            {dispositivo.descricao}
            {modo === "transferir" &&
              " — o vínculo atual será encerrado automaticamente."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="vinc-busca">
              {modo === "transferir" ? "Novo usuário" : "Usuário"}
            </Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="vinc-busca"
                type="search"
                autoFocus
                autoComplete="off"
                placeholder="Buscar por nome, e-mail ou loja"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                disabled={ocupado}
                className="pl-8"
                aria-controls="vinc-lista"
              />
            </div>
            <div
              id="vinc-lista"
              role="listbox"
              aria-label="Usuários"
              aria-invalid={Boolean(erros.colaborador_id)}
              className={cn(
                "max-h-56 overflow-y-auto rounded-lg border",
                erros.colaborador_id && "border-destructive",
              )}
            >
              {opcoes.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  Nenhum usuário ativo encontrado.
                </p>
              )}
              {opcoes.slice(0, MAX_RESULTADOS).map((c) => {
                const ativo = c.id === colaboradorId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    disabled={ocupado}
                    onClick={() => setColaboradorId(c.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted",
                      ativo && "bg-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.loja_nome ?? "—"} · {c.email}
                      </span>
                    </span>
                    {ativo && <CheckIcon className="size-4 shrink-0" />}
                  </button>
                );
              })}
              {opcoes.length > MAX_RESULTADOS && (
                <p className="p-3 text-xs text-muted-foreground">
                  Mostrando {MAX_RESULTADOS} de {opcoes.length}. Refine a busca.
                </p>
              )}
            </div>
            {erros.colaborador_id && (
              <p className="text-sm text-destructive">{erros.colaborador_id}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vinc-termo">Termo de responsabilidade (PDF, até 5 MB)</Label>
            <Input
              id="vinc-termo"
              type="file"
              accept="application/pdf,.pdf"
              disabled={ocupado}
              aria-invalid={Boolean(erros.termo_path)}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setArquivo(f);
                setErros((atual) => ({ ...atual, termo_path: validarArquivo(f) ?? undefined }));
              }}
            />
            {erros.termo_path && (
              <p className="text-sm text-destructive">{erros.termo_path}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vinc-obs">Observação (opcional)</Label>
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
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {erros.geral}
            </p>
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
                : modo === "transferir"
                  ? "Transferir"
                  : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
