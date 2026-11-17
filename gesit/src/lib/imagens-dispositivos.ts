import { adicionarImagensDispositivo } from "@/app/(app)/dispositivos/actions";
import type { ItemAnexo } from "@/components/campo-anexos";
import { aleatorio } from "@/lib/anexos-baixa";
import { executarAcao } from "@/lib/executar-acao";
import { createClient } from "@/lib/supabase/client";
import type { MomentoImagem } from "@/lib/types";

/**
 * Imagens do item (migration 020): JPG, PNG ou WebP até 10 MB, no bucket
 * privado "imagens-dispositivos", em {dispositivo_id}/{timestamp}-{aleatorio}.{ext}.
 * Antes do envio, redimensionadas no navegador (lado maior até 1600 px) e
 * gravadas como JPEG. Uso apenas no navegador.
 */
export const IMAGEM_TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB
export const IMAGENS_MAXIMO = 20;
export const IMAGEM_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

/** Lado maior depois do redimensionamento. */
const LADO_MAXIMO = 1600;
/** Abaixo disso e já no tamanho, a imagem vai como está. */
const LEVE = 1024 * 1024;

const EXTENSOES: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function tipoDaImagem(arquivo: File): string | null {
  if (EXTENSOES[arquivo.type]) return arquivo.type;
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".jpg") || nome.endsWith(".jpeg")) return "image/jpeg";
  if (nome.endsWith(".png")) return "image/png";
  if (nome.endsWith(".webp")) return "image/webp";
  return null;
}

/** Mensagem de erro (com o nome do arquivo), ou null se for válida. */
export function validarImagem(arquivo: File): string | null {
  if (!tipoDaImagem(arquivo)) return `${arquivo.name}: envie uma imagem JPG, PNG ou WebP.`;
  if (arquivo.size > IMAGEM_TAMANHO_MAXIMO) return `${arquivo.name}: o limite é 10 MB.`;
  return null;
}

/**
 * Redimensiona para o lado maior de até 1600 px e grava em JPEG (qualidade
 * 0,85). Se não for possível decodificar, ou se a imagem já for pequena e
 * leve, devolve o arquivo original.
 */
export async function comprimirImagem(arquivo: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    return arquivo;
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  if (escala === 1 && arquivo.size <= LEVE) {
    bitmap.close();
    return arquivo;
  }

  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return arquivo;
  }
  // JPEG não tem transparência: fundo branco no lugar do preto (prints em PNG).
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    canvas.toBlob(resolver, "image/jpeg", 0.85),
  );
  if (!blob || (escala === 1 && blob.size >= arquivo.size)) return arquivo;
  const nome = `${arquivo.name.replace(/\.[^.]+$/, "") || "imagem"}.jpg`;
  return new File([blob], nome, { type: "image/jpeg", lastModified: arquivo.lastModified });
}

async function enviarImagem(
  dispositivoId: string,
  arquivo: File,
): Promise<{ path: string } | { erro: string }> {
  const pronto = await comprimirImagem(arquivo);
  const contentType = tipoDaImagem(pronto);
  if (!contentType) return { erro: validarImagem(arquivo) ?? "Imagem inválida." };
  if (pronto.size > IMAGEM_TAMANHO_MAXIMO) return { erro: `${arquivo.name}: o limite é 10 MB.` };

  const path = `${dispositivoId}/${Date.now()}-${aleatorio()}.${EXTENSOES[contentType]}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("imagens-dispositivos")
    .upload(path, pronto, { contentType, upsert: false });
  if (error) {
    console.error("Erro ao enviar imagem do dispositivo:", error);
    return { erro: `Não foi possível enviar ${arquivo.name}. Verifique a imagem e tente novamente.` };
  }
  return { path };
}

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
      const envio = await enviarImagem(dispositivoId, item.arquivo);
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
