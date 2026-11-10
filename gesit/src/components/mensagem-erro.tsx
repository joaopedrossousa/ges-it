/**
 * Mensagem de erro de um campo. Use o mesmo `id` no aria-describedby do
 * campo para o leitor de tela anunciar o erro junto com o rótulo.
 */
export function MensagemErro({ id, mensagem }: { id: string; mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {mensagem}
    </p>
  );
}
