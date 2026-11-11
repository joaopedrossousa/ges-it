"use client";

import { ChevronDownIcon, DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Carregando } from "@/components/carregando";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Formato, TipoRelatorio } from "@/lib/relatorios/tipos";

type Params = Record<string, string | undefined>;

const ROTULO: Record<Formato, string> = { pdf: "PDF", xlsx: "Excel" };
const ICONE: Record<Formato, typeof FileTextIcon> = { pdf: FileTextIcon, xlsx: FileSpreadsheetIcon };

/** Erro com texto já pronto para o usuário. */
class ErroExportacao extends Error {}

async function mensagemDaResposta(res: Response) {
  try {
    const corpo: unknown = await res.json();
    if (corpo && typeof corpo === "object" && "erro" in corpo && typeof corpo.erro === "string") {
      return corpo.erro;
    }
  } catch {
    // Corpo não é JSON (ex.: erro do servidor de hospedagem).
  }
  return res.status === 504 || res.status === 502
    ? "O relatório demorou demais para ser gerado. Refine os filtros e tente novamente."
    : "Não foi possível gerar o relatório. Tente novamente.";
}

function nomeDoArquivo(disposicao: string | null) {
  return disposicao?.match(/filename="([^"]+)"/)?.[1] ?? null;
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  // Dá tempo ao navegador de iniciar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Gera o relatório no servidor e baixa o arquivo; erros viram toast em português. */
export function useExportar() {
  const [gerando, setGerando] = useState<Formato | null>(null);

  async function exportar(relatorio: TipoRelatorio, formato: Formato, params: Params = {}) {
    if (gerando) return;
    setGerando(formato);
    try {
      const qs = new URLSearchParams({ formato });
      for (const [chave, valor] of Object.entries(params)) if (valor) qs.set(chave, valor);

      let res: Response;
      try {
        res = await fetch(`/api/relatorios/${relatorio}?${qs}`, { cache: "no-store" });
      } catch {
        throw new ErroExportacao("Sem conexão com o servidor. Verifique a internet e tente novamente.");
      }
      // O proxy manda para /login quando a sessão acaba.
      if (res.redirected && new URL(res.url).pathname === "/login") {
        throw new ErroExportacao("Sua sessão expirou. Entre novamente.");
      }
      if (!res.ok) throw new ErroExportacao(await mensagemDaResposta(res));

      const blob = await res.blob();
      baixar(blob, nomeDoArquivo(res.headers.get("Content-Disposition")) ?? `gesit-${relatorio}.${formato}`);
      toast.success(`${ROTULO[formato]} gerado.`);
    } catch (e) {
      toast.error(
        e instanceof ErroExportacao ? e.message : "Não foi possível gerar o relatório. Tente novamente.",
      );
    } finally {
      setGerando(null);
    }
  }

  return { gerando, exportar };
}

/** Anúncio para leitores de tela enquanto o arquivo é gerado. */
function AvisoGerando({ gerando }: { gerando: Formato | null }) {
  return (
    <span className="sr-only" aria-live="polite">
      {gerando ? `Gerando ${ROTULO[gerando]}...` : ""}
    </span>
  );
}

type Props = {
  relatorio: TipoRelatorio;
  params?: Params;
  size?: "sm" | "default";
};

/** Botão "Exportar" com menu PDF / Excel. */
export function ExportarMenu({ relatorio, params, size = "default" }: Props) {
  const { gerando, exportar } = useExportar();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} disabled={gerando !== null}>
            {gerando ? <Carregando decorativo tamanho="sm" /> : <DownloadIcon />}
            {gerando ? "Gerando..." : "Exportar"}
            {!gerando && <ChevronDownIcon className="opacity-60" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(["pdf", "xlsx"] as const).map((formato) => {
            const Icone = ICONE[formato];
            return (
              <DropdownMenuItem key={formato} onSelect={() => void exportar(relatorio, formato, params)}>
                <Icone />
                {ROTULO[formato]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <AvisoGerando gerando={gerando} />
    </>
  );
}

/** Dois botões lado a lado (PDF e Excel), para a página de relatórios. */
export function ExportarBotoes({
  relatorio,
  params,
  desabilitado,
}: Props & { desabilitado?: boolean }) {
  const { gerando, exportar } = useExportar();

  return (
    <div className="flex flex-wrap gap-2">
      {(["pdf", "xlsx"] as const).map((formato) => {
        const Icone = ICONE[formato];
        return (
          <Button
            key={formato}
            variant={formato === "pdf" ? "default" : "outline"}
            disabled={desabilitado || gerando !== null}
            onClick={() => void exportar(relatorio, formato, params)}
          >
            {gerando === formato ? <Carregando decorativo tamanho="sm" /> : <Icone />}
            {gerando === formato ? "Gerando..." : ROTULO[formato]}
          </Button>
        );
      })}
      <AvisoGerando gerando={gerando} />
    </div>
  );
}
