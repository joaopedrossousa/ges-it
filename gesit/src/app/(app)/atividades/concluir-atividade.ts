import { toast } from "sonner";

import { executarAcao } from "@/lib/executar-acao";

import { arquivarAtividade, restaurarAtividade } from "./actions";

/**
 * Conclui a atividade (sai do quadro e vai para Concluídas; no banco,
 * arquivar_atividade) e mostra o aviso com "Desfazer", que a reabre no fim
 * da coluna em que estava. Usado pelo painel e pelo menu "..." do cartão.
 */
export async function concluirAtividade(id: string) {
  const r = await executarAcao(() => arquivarAtividade(id));
  if (!r.ok) return r;
  toast.success("Atividade concluída.", {
    description: "Ela saiu do quadro e está em Concluídas.",
    action: {
      label: "Desfazer",
      onClick: async () => {
        const d = await executarAcao(() => restaurarAtividade(id));
        if (d.ok) toast.success("Atividade reaberta.");
        else toast.error("Não foi possível desfazer.", { description: d.error });
      },
    },
  });
  return r;
}
