"use client";

import { CHAVE_ORIGEM, EVENTO_HISTORICO } from "@/lib/navegacao-interna";

/**
 * Marca as entradas do histórico criadas por navegação interna (ver
 * src/lib/navegacao-interna.ts). Fica no layout do app: só as navegações
 * feitas a partir de uma tela do GesIT recebem a marca.
 *
 * - pushState: a nova entrada recebe o endereço da tela atual (a anterior).
 * - replaceState: repassa a marca da entrada atual. O Next chama replaceState
 *   com um objeto novo em router.refresh() (ex.: depois de salvar), em
 *   router.replace() (filtros) e ao hidratar; sem isso a marca se perderia.
 *
 * A troca é feita ao carregar o módulo, antes da hidratação: o Next regrava
 * history.state num useInsertionEffect, que roda antes de qualquer useEffect.
 * Ele encadeia a própria troca por cima desta (guarda a função atual como
 * "original"), então as duas valem. Se a marca faltar por qualquer motivo, o
 * Voltar só cai no comportamento antigo (a listagem da seção).
 */
const INSTALADO = Symbol.for("gesit.rastreadorNavegacao");

type HistoryMarcado = History & { [INSTALADO]?: true };

function comMarca(dados: unknown, origem: string | null): unknown {
  if (origem === null) return dados;
  if (dados !== null && dados !== undefined && typeof dados !== "object") return dados;
  return { ...(dados ?? {}), [CHAVE_ORIGEM]: origem };
}

function origemAtual(): string | null {
  const estado: unknown = window.history.state;
  if (!estado || typeof estado !== "object") return null;
  const origem = (estado as Record<string, unknown>)[CHAVE_ORIGEM];
  return typeof origem === "string" ? origem : null;
}

function jaTemMarca(dados: unknown) {
  return !!dados && typeof dados === "object" && CHAVE_ORIGEM in dados;
}

/** Avisa o BotaoVoltar fora do ciclo do React (o Next grava num useInsertionEffect). */
function avisar() {
  queueMicrotask(() => window.dispatchEvent(new Event(EVENTO_HISTORICO)));
}

function instalar() {
  const historico = window.history as HistoryMarcado;
  if (historico[INSTALADO]) return; // recarga do módulo em desenvolvimento
  historico[INSTALADO] = true;

  const push = historico.pushState.bind(historico);
  const replace = historico.replaceState.bind(historico);

  historico.pushState = function pushState(dados, unused, url) {
    const aqui = window.location.pathname + window.location.search;
    push(comMarca(dados, aqui), unused, url);
    avisar();
  };

  historico.replaceState = function replaceState(dados, unused, url) {
    replace(jaTemMarca(dados) ? dados : comMarca(dados, origemAtual()), unused, url);
    avisar();
  };
}

if (typeof window !== "undefined") instalar();

/** Só carrega o módulo acima no layout; não desenha nada. */
export function RastreadorNavegacao() {
  return null;
}
