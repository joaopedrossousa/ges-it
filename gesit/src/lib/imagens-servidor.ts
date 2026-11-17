import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Ids por consulta: o filtro in.(...) vai na URL, que tem limite de tamanho. */
const LOTE = 150;

/**
 * Quantidade de imagens (não removidas) de cada vínculo, para a coluna
 * "Imagens" do histórico (migration 020). Vínculo sem imagem fica fora do mapa.
 */
export async function contarImagensPorVinculo(
  supabase: Supabase,
  vinculoIds: string[],
): Promise<Map<string, number>> {
  const contagem = new Map<string, number>();
  for (let i = 0; i < vinculoIds.length; i += LOTE) {
    const { data, error } = await supabase
      .from("dispositivo_imagens")
      .select("vinculo_id")
      .eq("removida", false)
      .in("vinculo_id", vinculoIds.slice(i, i + LOTE));
    if (error) {
      console.error("Erro ao contar imagens dos vínculos:", error);
      return contagem;
    }
    for (const { vinculo_id } of data) {
      if (vinculo_id) contagem.set(vinculo_id, (contagem.get(vinculo_id) ?? 0) + 1);
    }
  }
  return contagem;
}
