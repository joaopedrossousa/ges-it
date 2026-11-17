import { createClient } from "@/lib/supabase/client";

/**
 * Anexos (nota fiscal e serviços do dispositivo; boleto/NF do lançamento
 * financeiro): PDF, JPG ou PNG até 10 MB, em buckets privados, no caminho
 * {pasta}/{timestamp}.{ext}. A pasta é o id do dispositivo ("notas-fiscais",
 * "servicos") ou do lançamento ("financeiro").
 * Mesmas regras dos buckets e das checks das migrations 009, 011 e 015.
 */
export type BucketAnexo = "notas-fiscais" | "servicos" | "financeiro";

export const ANEXO_TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/** Para o atributo accept do <input type="file">. */
export const ANEXO_ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

/** {id do dispositivo ou do lançamento}/{timestamp}.{pdf|jpg|png} */
export const REGEX_CAMINHO_ANEXO = /^[0-9a-f-]{36}\/\d+\.(pdf|jpg|png)$/;

/** Tipos aceitos pelos buckets e a extensão gravada no caminho. */
const EXTENSOES: Record<string, "pdf" | "jpg" | "png"> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Tipo MIME pelo navegador ou, se ausente, pela extensão do nome. */
function tipoDoArquivo(arquivo: File): string | null {
  if (EXTENSOES[arquivo.type]) return arquivo.type;
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".pdf")) return "application/pdf";
  if (nome.endsWith(".jpg") || nome.endsWith(".jpeg")) return "image/jpeg";
  if (nome.endsWith(".png")) return "image/png";
  return null;
}

/** Mensagem de erro, ou null se o arquivo for válido (ou ausente). `nome`: "A nota fiscal", "O anexo". */
export function validarArquivoAnexo(arquivo: File | null, nome: string): string | null {
  if (!arquivo) return null;
  if (!tipoDoArquivo(arquivo)) return `${nome} deve ser PDF, JPG ou PNG.`;
  if (arquivo.size > ANEXO_TAMANHO_MAXIMO) return `${nome} deve ter no máximo 10 MB.`;
  return null;
}

/**
 * Envia o arquivo direto do navegador para o bucket, em
 * {pastaId}/{timestamp}.{ext}. O dispositivo (ou lançamento) já precisa
 * existir: a policy de insert confere a pasta. Uso apenas em Client Components.
 */
export async function enviarAnexo(
  bucket: BucketAnexo,
  pastaId: string,
  arquivo: File,
): Promise<{ path: string } | { erro: string }> {
  const contentType = tipoDoArquivo(arquivo);
  if (!contentType) return { erro: "O arquivo deve ser PDF, JPG ou PNG." };

  const path = `${pastaId}/${Date.now()}.${EXTENSOES[contentType]}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, arquivo, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.error(`Erro ao enviar arquivo para ${bucket}:`, error);
    return { erro: "Não foi possível enviar o arquivo. Verifique-o e tente novamente." };
  }
  return { path };
}
