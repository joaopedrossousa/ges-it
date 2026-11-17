import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import {
  SITUACAO_PAGAMENTO_LABEL,
  SITUACAO_VENCIMENTO_LABEL,
  paraSituacaoVencimento,
  type SituacaoVencimento,
} from "@/lib/financeiro";
import type { SituacaoPagamento } from "@/lib/types";

const VERDE = "bg-brand-green/15 text-brand-green-strong dark:bg-brand-green/20";
const AZUL = "bg-brand-blue/10 text-brand-blue dark:bg-primary/20 dark:text-primary";
const AMBAR = "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400";
const VERMELHO = "bg-destructive/10 text-destructive dark:bg-destructive/20";
const CINZA = "bg-muted text-muted-foreground";

const CORES_PAGAMENTO: Record<SituacaoPagamento, string> = {
  solicitado_compras: CINZA,
  enviado_financeiro: AZUL,
  pago: VERDE,
  nao_pago: VERMELHO,
  cancelado: `${CINZA} line-through decoration-1`,
};

export function SituacaoPagamentoBadge({ situacao }: { situacao: SituacaoPagamento | null }) {
  if (!situacao) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge className={cn("border-transparent", CORES_PAGAMENTO[situacao])}>
      {SITUACAO_PAGAMENTO_LABEL[situacao]}
    </Badge>
  );
}

const CORES_VENCIMENTO: Record<SituacaoVencimento, string> = {
  vencido: VERMELHO,
  proximo: AMBAR,
  a_vencer: VERDE,
  pago: CINZA,
  cancelado: CINZA,
};

/** situacao_vencimento da vw_lancamentos (data de Palmas). */
export function SituacaoVencimentoBadge({ situacao }: { situacao: string | null }) {
  const s = paraSituacaoVencimento(situacao);
  if (!s) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge className={cn("border-transparent", CORES_VENCIMENTO[s])}>
      {SITUACAO_VENCIMENTO_LABEL[s]}
    </Badge>
  );
}
