import {
  ArrowRightLeftIcon,
  CalendarClockIcon,
  CalendarX2Icon,
  HistoryIcon,
  SirenIcon,
  SquareUserRoundIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { primeiroNomeUsuario } from "@/lib/atividades";
import { listarUsuariosSistema, usuarioLogadoId } from "@/lib/atividades-servidor";

import { AtividadesRecentes, MeusCards, Urgentes } from "./bloco-atividades";
import { ContasVencidas, ProximasDoVencimento } from "./bloco-financeiro";
import { ResumoMovimentacoes } from "./bloco-movimentacoes";
import { BlocoCarregando } from "./bloco";

export const metadata: Metadata = { title: "Início" };

/**
 * Tela inicial (aberta logo após o login): o que pede atenção hoje.
 * Cada bloco carrega e falha sozinho (Suspense próprio; erro tratado
 * dentro do bloco), sem derrubar os demais.
 */
export default function InicioPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
        <Suspense fallback={<p className="text-muted-foreground">O que pede atenção hoje.</p>}>
          <Saudacao />
        </Suspense>
      </div>

      {/* Urgentes primeiro, na largura total e em destaque. */}
      <section aria-label="Urgentes">
        <Suspense fallback={<BlocoCarregando titulo="Urgentes" icone={SirenIcon} destaque />}>
          <Urgentes />
        </Suspense>
      </section>

      <section aria-label="Financeiro" className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Suspense fallback={<BlocoCarregando titulo="Contas Vencidas" icone={CalendarX2Icon} />}>
          <ContasVencidas />
        </Suspense>
        <Suspense
          fallback={<BlocoCarregando titulo="Próximas do Vencimento" icone={CalendarClockIcon} />}
        >
          <ProximasDoVencimento />
        </Suspense>
      </section>

      {/* Meus Cards em largura total (as colunas do quadro lado a lado). */}
      <section aria-label="Meus cards">
        <Suspense fallback={<BlocoCarregando titulo="Meus Cards" icone={SquareUserRoundIcon} />}>
          <MeusCards />
        </Suspense>
      </section>

      {/* Atividades Recentes e Resumo de Movimentações lado a lado. */}
      <section aria-label="Movimentações" className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Suspense
          fallback={<BlocoCarregando titulo="Atividades Recentes" icone={HistoryIcon} linhas={6} />}
        >
          <AtividadesRecentes />
        </Suspense>
        <Suspense
          fallback={
            <BlocoCarregando titulo="Resumo de Movimentações" icone={ArrowRightLeftIcon} linhas={6} />
          }
        >
          <ResumoMovimentacoes />
        </Suspense>
      </section>
    </div>
  );
}

/** "Olá, Maria. Veja o que pede atenção hoje." (nome do cadastro, senão o e-mail). */
async function Saudacao() {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  let nome: string | null = null;
  try {
    const [uid, usuarios] = await Promise.all([usuarioLogadoId(), listarUsuariosSistema()]);
    const u = usuarios.find((x) => x.id === uid);
    nome = primeiroNomeUsuario(u);
  } catch (e) {
    console.error("Erro ao carregar a saudação:", e);
  }
  return (
    <p className="text-muted-foreground">
      {nome ? `Olá, ${nome}. Veja o que pede atenção hoje.` : "O que pede atenção hoje."}
    </p>
  );
}
