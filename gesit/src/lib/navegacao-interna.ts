/**
 * Navegação interna (botão "Voltar" das telas de detalhe).
 *
 * Cada entrada do histórico criada por uma navegação DENTRO do GesIT (nesta
 * aba) leva em history.state a chave CHAVE_ORIGEM com o endereço da tela de
 * onde se veio. Assim a marca é por entrada: sobrevive a recarregar a página e
 * acompanha Voltar/Avançar do navegador; um link aberto direto (Telegram,
 * favorito, nova aba) não tem a marca. sessionStorage não serve: é um só para a
 * aba inteira e não sabe em qual entrada do histórico o usuário está.
 *
 * O Next regrava history.state com um objeto novo a cada navegação e a cada
 * router.refresh() (src/components/layout/rastreador-navegacao.tsx repassa a
 * marca nessas regravações).
 */
export const CHAVE_ORIGEM = "__gesitOrigem";

/** Evento disparado depois de cada pushState/replaceState (atualiza o title do Voltar). */
export const EVENTO_HISTORICO = "gesit:historico";

/** Endereço (caminho + query) da tela anterior do app nesta aba, ou null. */
export function origemInterna(): string | null {
  if (typeof window === "undefined") return null;
  const estado: unknown = window.history.state;
  if (!estado || typeof estado !== "object" || !(CHAVE_ORIGEM in estado)) return null;
  const origem = (estado as Record<string, unknown>)[CHAVE_ORIGEM];
  if (typeof origem !== "string" || !origem.startsWith("/") || origem.startsWith("//")) return null;
  // Login (ex.: entrar com ?next= para um detalhe) não é tela do app: Voltar vai à listagem.
  if (/^\/(login|api)(\/|\?|$)/.test(origem)) return null;
  return origem;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Destinos com nome no title do Voltar; o resto vira "a tela anterior". */
const DESTINOS: [RegExp, string][] = [
  [new RegExp(`^/colaboradores/${UUID}$`, "i"), "o colaborador"],
  [new RegExp(`^/dispositivos/${UUID}$`, "i"), "o dispositivo"],
  [/^\/colaboradores$/, "Colaboradores"],
  [/^\/dispositivos$/, "Dispositivos"],
  [/^\/inicio$/, "o Início"],
  [/^\/$/, "o Dashboard"],
  [/^\/lojas$/, "Lojas"],
  [/^\/relatorios$/, "Relatórios"],
  [/^\/auditoria$/, "Auditoria"],
  [/^\/atividades$/, "o quadro de atividades"],
  [/^\/atividades\/concluidas$/, "Atividades Concluídas"],
  [/^\/financeiro$/, "o Painel Financeiro"],
  [/^\/financeiro\/lancamentos$/, "Lançamentos"],
];

/** "Voltar para o colaborador", "Voltar para Dispositivos", "Voltar para a tela anterior". */
export function tituloVoltar(destino: string): string {
  const caminho = destino.split(/[?#]/)[0];
  const nome = DESTINOS.find(([padrao]) => padrao.test(caminho))?.[1] ?? "a tela anterior";
  return `Voltar para ${nome}`;
}
