import {
  ANEXO_ACCEPT,
  REGEX_CAMINHO_ANEXO,
  enviarAnexo,
  validarArquivoAnexo,
} from "@/lib/anexos";

/** Nota fiscal: bucket "notas-fiscais" (migration 009), regras de src/lib/anexos.ts. */
export const NOTA_FISCAL_ACCEPT = ANEXO_ACCEPT;

/** Caminho aceito pela check nota_fiscal_path_valido: {dispositivo_id}/{timestamp}.{ext} */
export const REGEX_CAMINHO_NOTA_FISCAL = REGEX_CAMINHO_ANEXO;

export function validarArquivoNotaFiscal(arquivo: File | null): string | null {
  return validarArquivoAnexo(arquivo, "A nota fiscal");
}

/** Uso apenas em Client Components. */
export async function enviarNotaFiscal(dispositivoId: string, arquivo: File) {
  const envio = await enviarAnexo("notas-fiscais", dispositivoId, arquivo);
  return "erro" in envio
    ? { erro: "Não foi possível enviar a nota fiscal. Verifique o arquivo e tente novamente." }
    : envio;
}
