"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore, type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { EVENTO_HISTORICO, origemInterna, tituloVoltar } from "@/lib/navegacao-interna";

function assinar(aoMudar: () => void) {
  window.addEventListener(EVENTO_HISTORICO, aoMudar);
  window.addEventListener("popstate", aoMudar);
  return () => {
    window.removeEventListener(EVENTO_HISTORICO, aoMudar);
    window.removeEventListener("popstate", aoMudar);
  };
}

/** No servidor não há histórico: o botão nasce apontando para a listagem. */
const semOrigem = () => null;

/**
 * "Voltar" das telas de detalhe. Se a tela anterior foi do próprio GesIT nesta
 * aba (marca em history.state, src/lib/navegacao-interna.ts), faz
 * router.back(): volta exatamente para lá, com filtros, página e rolagem.
 * Sem tela anterior do app (link direto, Telegram, favorito, nova aba), vai
 * para `padrao`, a listagem da seção.
 *
 * É um link para `padrao`: Ctrl+clique / botão do meio abrem a listagem em
 * outra aba, como antes.
 */
export function BotaoVoltar({ padrao, rotuloPadrao }: {
  /** Listagem da seção (ex.: "/dispositivos"). */
  padrao: string;
  /** Nome da listagem no title (ex.: "Dispositivos"); padrão: tituloVoltar(padrao). */
  rotuloPadrao?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const origem = useSyncExternalStore(assinar, origemInterna, semOrigem);

  // Origem na mesma tela (ex.: só a query mudou) não é "voltar": usa a listagem.
  const voltaNoHistorico = origem !== null && origem.split(/[?#]/)[0] !== pathname;
  const titulo = voltaNoHistorico
    ? tituloVoltar(origem)
    : rotuloPadrao
      ? `Voltar para ${rotuloPadrao}`
      : tituloVoltar(padrao);

  function aoClicar(e: MouseEvent<HTMLAnchorElement>) {
    // Abrir em outra aba / janela: segue o link (listagem).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Confere de novo no clique: a marca é da entrada atual do histórico.
    const agora = origemInterna();
    if (agora !== null && agora.split(/[?#]/)[0] !== pathname) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link href={padrao} onClick={aoClicar} title={titulo}>
        <ArrowLeftIcon />
        Voltar
        <span className="sr-only"> {titulo.replace(/^Voltar /, "")}</span>
      </Link>
    </Button>
  );
}
