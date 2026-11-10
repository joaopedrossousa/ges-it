import { createClient } from "@/lib/supabase/client";

/** Mesmo limite do bucket "termos". */
export const TERMO_TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

/** Mensagem de erro, ou null se o arquivo for válido (ou ausente). */
export function validarArquivoTermo(arquivo: File | null): string | null {
  if (!arquivo) return null;
  const ehPdf =
    arquivo.type === "application/pdf" ||
    arquivo.name.toLowerCase().endsWith(".pdf");
  if (!ehPdf) return "O termo deve ser um arquivo PDF.";
  if (arquivo.size > TERMO_TAMANHO_MAXIMO) return "O termo deve ter no máximo 5 MB.";
  return null;
}

/**
 * Envia o PDF direto do navegador para o bucket privado "termos",
 * em <dispositivo_id>/<timestamp>-<uuid>.pdf. Uso apenas em Client Components.
 */
export async function enviarTermo(
  dispositivoId: string,
  arquivo: File,
): Promise<{ path: string } | { erro: string }> {
  const path = `${dispositivoId}/${Date.now()}-${crypto.randomUUID()}.pdf`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("termos").upload(path, arquivo, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) {
    console.error("Erro ao enviar termo:", error);
    return {
      erro: "Não foi possível enviar o termo. Verifique o arquivo e tente novamente.",
    };
  }
  return { path };
}
