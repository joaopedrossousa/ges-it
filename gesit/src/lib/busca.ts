/** Itens por página nas listagens paginadas. */
export const POR_PAGINA = 50;

/** Máximo de resultados das buscas dos comboboxes. */
export const LIMITE_BUSCA = 20;

/** Mínimo de caracteres para buscar no servidor. */
export const MINIMO_BUSCA = 2;

/** Primeiro valor de um parâmetro de URL (que pode vir repetido). */
export function primeiro(valor: string | string[] | undefined | null) {
  return Array.isArray(valor) ? valor[0] : (valor ?? undefined);
}

/** Remove caracteres com significado na sintaxe de filtros do PostgREST. */
export function limparBusca(valor: string) {
  return valor.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim();
}

/** Palavras da busca (cada uma precisa casar com algum campo). */
export function palavrasBusca(valor: string, maximo = 4) {
  return limparBusca(valor).split(" ").filter(Boolean).slice(0, maximo);
}

/** Número da página a partir de ?page= (inteiro ≥ 1; inválido vira 1). */
export function paginaDoParametro(valor: string | undefined) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Faixa de linhas para .range() do PostgREST. */
export function faixaDaPagina(pagina: number, porPagina = POR_PAGINA) {
  const de = (pagina - 1) * porPagina;
  return { de, ate: de + porPagina - 1 };
}

type Params = Record<string, string | string[] | undefined>;

/** URL da listagem mantendo os filtros e trocando só a página. */
export function hrefPagina(pathname: string, params: Params, pagina: number) {
  const qs = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    const v = primeiro(valor);
    if (chave !== "page" && v) qs.set(chave, v);
  }
  if (pagina > 1) qs.set("page", String(pagina));
  const texto = qs.toString();
  return texto ? `${pathname}?${texto}` : pathname;
}
