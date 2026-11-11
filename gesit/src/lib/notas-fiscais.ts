import { createClient } from "@/lib/supabase/client";

/** Mesmo limite do bucket "notas-fiscais" (migration 009). */
export const NOTA_FISCAL_TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/** Tipos aceitos pelo bucket e a extensão gravada no caminho. */
const EXTENSOES: Record<string, "pdf" | "jpg" | "png"> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Para o atributo accept do <input type="file">. */
export const NOTA_FISCAL_ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

/** Caminho aceito pela check nota_fiscal_path_valido: {dispositivo_id}/{timestamp}.{ext} */
export const REGEX_CAMINHO_NOTA_FISCAL = /^[0-9a-f-]{36}\/\d+\.(pdf|jpg|png)$/;

/** Tipo MIME pelo navegador ou, se ausente, pela extensão do nome. */
function tipoDoArquivo(arquivo: File): string | null {
  if (EXTENSOES[arquivo.type]) return arquivo.type;
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".pdf")) return "application/pdf";
  if (nome.endsWith(".jpg") || nome.endsWith(".jpeg")) return "image/jpeg";
  if (nome.endsWith(".png")) return "image/png";
  return null;
}

/** Mensagem de erro, ou null se o arquivo for válido (ou ausente). */
export function validarArquivoNotaFiscal(arquivo: File | null): string | null {
  if (!arquivo) return null;
  if (!tipoDoArquivo(arquivo)) return "A nota fiscal deve ser PDF, JPG ou PNG.";
  if (arquivo.size > NOTA_FISCAL_TAMANHO_MAXIMO) {
    return "A nota fiscal deve ter no máximo 10 MB.";
  }
  return null;
}

/**
 * Envia o arquivo direto do navegador para o bucket privado "notas-fiscais",
 * em {dispositivo_id}/{timestamp}.{ext}. O dispositivo já precisa existir
 * (a policy de insert confere a pasta). Uso apenas em Client Components.
 */
export async function enviarNotaFiscal(
  dispositivoId: string,
  arquivo: File,
): Promise<{ path: string } | { erro: string }> {
  const contentType = tipoDoArquivo(arquivo);
  if (!contentType) return { erro: "A nota fiscal deve ser PDF, JPG ou PNG." };

  const path = `${dispositivoId}/${Date.now()}.${EXTENSOES[contentType]}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("notas-fiscais").upload(path, arquivo, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.error("Erro ao enviar nota fiscal:", error);
    return {
      erro: "Não foi possível enviar a nota fiscal. Verifique o arquivo e tente novamente.",
    };
  }
  return { path };
}
