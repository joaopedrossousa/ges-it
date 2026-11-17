import { createClient } from "@/lib/supabase/client";

/**
 * Anexos da baixa (migration 019): JPG, PNG, WebP ou PDF até 10 MB cada, no
 * bucket privado "baixas", em {dispositivo_id}/{timestamp}-{aleatorio}.{ext}
 * (vários arquivos no mesmo milissegundo não colidem). Enviados ANTES de
 * baixar_dispositivo, que confere cada caminho. Uso apenas no navegador.
 */
export const ANEXO_BAIXA_TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB
export const ANEXOS_BAIXA_MAXIMO = 20;

/** Para o atributo accept do <input type="file">. */
export const ANEXO_BAIXA_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";

const EXTENSOES: Record<string, "jpg" | "png" | "webp" | "pdf"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Tipo MIME pelo navegador ou, se ausente, pela extensão do nome. */
function tipoDoArquivo(arquivo: File): string | null {
  if (EXTENSOES[arquivo.type]) return arquivo.type;
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".pdf")) return "application/pdf";
  if (nome.endsWith(".jpg") || nome.endsWith(".jpeg")) return "image/jpeg";
  if (nome.endsWith(".png")) return "image/png";
  if (nome.endsWith(".webp")) return "image/webp";
  return null;
}

/** Mensagem de erro (com o nome do arquivo), ou null se for válido. */
export function validarArquivoBaixa(arquivo: File): string | null {
  if (!tipoDoArquivo(arquivo)) return `${arquivo.name}: envie imagem (JPG, PNG ou WebP) ou PDF.`;
  if (arquivo.size > ANEXO_BAIXA_TAMANHO_MAXIMO) return `${arquivo.name}: o limite é 10 MB.`;
  return null;
}

/** 8 caracteres [a-z0-9] (o mesmo padrão das checks das migrations 019 e 020). */
export function aleatorio() {
  const letras = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

export async function enviarAnexoBaixa(
  dispositivoId: string,
  arquivo: File,
): Promise<{ path: string } | { erro: string }> {
  const contentType = tipoDoArquivo(arquivo);
  if (!contentType) return { erro: validarArquivoBaixa(arquivo) ?? "Arquivo inválido." };

  const path = `${dispositivoId}/${Date.now()}-${aleatorio()}.${EXTENSOES[contentType]}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("baixas").upload(path, arquivo, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.error("Erro ao enviar anexo da baixa:", error);
    return { erro: `Não foi possível enviar ${arquivo.name}. Verifique o arquivo e tente novamente.` };
  }
  return { path };
}
