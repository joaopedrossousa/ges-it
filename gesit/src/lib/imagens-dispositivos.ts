import { adicionarImagensDispositivo } from "@/app/(app)/dispositivos/actions";
import type { ItemAnexo } from "@/components/campo-anexos";
import { executarAcao } from "@/lib/executar-acao";
import { enviarImagemComprimida } from "@/lib/imagens-cliente";
import type { MomentoImagem } from "@/lib/types";

/**
 * Imagens do item (migration 020), no bucket privado "imagens-dispositivos"
 * em {dispositivo_id}/{timestamp}-{aleatorio}.{ext}. Regras de arquivo e
 * compressão em src/lib/imagens-cliente.ts. Uso apenas no navegador.
 */

/**
 * Comprime e envia as imagens e depois grava com adicionar_imagens_dispositivo.
 * `enviadas` (chave do item → caminho) guarda o que já subiu: numa nova
 * tentativa, nada é reenviado. Devolve a mensagem de erro, ou null.
 */
export async function gravarImagens(opcoes: {
  dispositivoId: string;
  momento: MomentoImagem;
  vinculoId?: string | null;
  itens: ItemAnexo[];
  enviadas: Map<string, string>;
  onProgresso?: (texto: string) => void;
}): Promise<string | null> {
  const { dispositivoId, momento, vinculoId, itens, enviadas, onProgresso } = opcoes;
  if (itens.length === 0) return null;

  const imagens: { path: string; legenda: string | null }[] = [];
  for (const [i, item] of itens.entries()) {
    let path = enviadas.get(item.chave);
    if (!path) {
      onProgresso?.(`Enviando imagens (${i + 1} de ${itens.length})...`);
      const envio = await enviarImagemComprimida("imagens-dispositivos", dispositivoId, item.arquivo);
      if ("erro" in envio) return envio.erro;
      path = envio.path;
      enviadas.set(item.chave, path);
    }
    imagens.push({ path, legenda: item.legenda?.trim() || null });
  }

  onProgresso?.("Salvando imagens...");
  const result = await executarAcao(() =>
    adicionarImagensDispositivo({
      dispositivo_id: dispositivoId,
      momento,
      vinculo_id: vinculoId ?? null,
      imagens,
    }),
  );
  return result.ok ? null : result.error;
}
