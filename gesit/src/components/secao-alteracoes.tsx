import { HistoryIcon } from "lucide-react";
import Link from "next/link";

import { TabelaAuditoria } from "@/components/tabela-auditoria";
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
  consultaAuditoria,
  montarLinhasAuditoria,
  type LinhaAuditoria,
} from "@/lib/auditoria-servidor";
import type { TabelaAuditoria as Tabela } from "@/lib/auditoria";
import { createClient } from "@/lib/supabase/server";

/** Linhas mostradas no detalhe; o resto fica em /auditoria. */
const LIMITE = 20;

/**
 * Seção "Alterações" dos detalhes do dispositivo e do usuário: o log
 * daquele registro (mais recentes primeiro), com link para o log completo.
 */
export async function SecaoAlteracoes({ tabela, registroId }: { tabela: Tabela; registroId: string }) {
  const supabase = await createClient();
  const { data, count, error } = await consultaAuditoria(
    supabase,
    { tabela, registro: registroId },
    true,
  ).limit(LIMITE);

  let linhas: LinhaAuditoria[] | null = null;
  try {
    if (error) throw error;
    linhas = await montarLinhasAuditoria(supabase, data);
  } catch (e) {
    console.error("Erro ao carregar alterações:", e);
  }

  const conteudo = linhas ? (
    <TabelaAuditoria
      linhas={linhas}
      mostrarRegistro={false}
      vazio="Nenhuma alteração registrada desde a ativação do log."
    />
  ) : (
    <p className="text-destructive">Não foi possível carregar as alterações.</p>
  );

  const total = count ?? data?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alterações</CardTitle>
        <CardDescription>
          {total > LIMITE
            ? `As ${LIMITE} mais recentes de ${total}.`
            : "Quem inseriu ou alterou este registro, e o que mudou."}
        </CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href={`/auditoria?tipo=${tabela}&registro=${registroId}`}>
              <HistoryIcon />
              Ver no log completo
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>{conteudo}</CardContent>
    </Card>
  );
}

export function SecaoAlteracoesCarregando() {
  return <div className="h-48 animate-pulse rounded-xl bg-muted" role="status" aria-label="Carregando..." />;
}
