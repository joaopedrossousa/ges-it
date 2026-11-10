import { unstable_rethrow } from "next/navigation";

export const MENSAGEM_FALHA_CONEXAO =
  "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.";

/**
 * Chama uma Server Action a partir de um Client Component.
 * Se a chamada falhar (sem rede, servidor fora do ar, erro inesperado),
 * devolve { ok: false } em vez de rejeitar, para o formulário mostrar a
 * mensagem em vez de cair na tela de erro. Erros internos do Next
 * (redirect(), notFound()) continuam sendo repassados.
 */
export type FalhaDeConexao = {
  ok: false;
  error: string;
  // Campos opcionais dos retornos das actions, ausentes nesta falha.
  fieldErrors?: never;
  dispositivosPendentes?: never;
};

export async function executarAcao<R>(
  acao: () => Promise<R>,
): Promise<R | FalhaDeConexao> {
  try {
    return await acao();
  } catch (erro) {
    unstable_rethrow(erro);
    console.error("Falha ao chamar a ação:", erro);
    return { ok: false, error: MENSAGEM_FALHA_CONEXAO };
  }
}
