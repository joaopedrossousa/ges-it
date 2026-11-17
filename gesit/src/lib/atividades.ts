import type { CorKanban, PrioridadeAtividade } from "@/lib/types";

/** Minúsculas e sem acento (mesma regra do ComboboxLista). */
const normalizarBusca = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

// ===========================================================================
// Rótulos e cores (migration 017)
// ===========================================================================

export const PRIORIDADE_LABEL: Record<PrioridadeAtividade, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

/** Cor do selo de prioridade (sempre com o texto ao lado). */
export const PRIORIDADE_COR: Record<PrioridadeAtividade, CorKanban> = {
  alta: "vermelho",
  media: "amarelo",
  baixa: "cinza",
};

export const COR_LABEL: Record<CorKanban, string> = {
  cinza: "Cinza",
  marrom: "Marrom",
  laranja: "Laranja",
  amarelo: "Amarelo",
  verde: "Verde",
  ciano: "Ciano",
  azul: "Azul",
  roxo: "Roxo",
  rosa: "Rosa",
  vermelho: "Vermelho",
};

/**
 * Classes por cor (tokens --etiqueta-* em globals.css). Escritas por extenso
 * para o Tailwind encontrá-las. `etiqueta`: fundo + texto; `ponto`: sólido.
 */
export const CLASSES_COR: Record<CorKanban, { etiqueta: string; ponto: string }> = {
  cinza: { etiqueta: "bg-etiqueta-cinza text-etiqueta-cinza-texto", ponto: "bg-etiqueta-cinza-ponto" },
  marrom: { etiqueta: "bg-etiqueta-marrom text-etiqueta-marrom-texto", ponto: "bg-etiqueta-marrom-ponto" },
  laranja: { etiqueta: "bg-etiqueta-laranja text-etiqueta-laranja-texto", ponto: "bg-etiqueta-laranja-ponto" },
  amarelo: { etiqueta: "bg-etiqueta-amarelo text-etiqueta-amarelo-texto", ponto: "bg-etiqueta-amarelo-ponto" },
  verde: { etiqueta: "bg-etiqueta-verde text-etiqueta-verde-texto", ponto: "bg-etiqueta-verde-ponto" },
  ciano: { etiqueta: "bg-etiqueta-ciano text-etiqueta-ciano-texto", ponto: "bg-etiqueta-ciano-ponto" },
  azul: { etiqueta: "bg-etiqueta-azul text-etiqueta-azul-texto", ponto: "bg-etiqueta-azul-ponto" },
  roxo: { etiqueta: "bg-etiqueta-roxo text-etiqueta-roxo-texto", ponto: "bg-etiqueta-roxo-ponto" },
  rosa: { etiqueta: "bg-etiqueta-rosa text-etiqueta-rosa-texto", ponto: "bg-etiqueta-rosa-ponto" },
  vermelho: { etiqueta: "bg-etiqueta-vermelho text-etiqueta-vermelho-texto", ponto: "bg-etiqueta-vermelho-ponto" },
};

// ===========================================================================
// Modelos do quadro
// ===========================================================================

export type ColunaQuadro = { id: string; nome: string; cor: CorKanban };

export type CategoriaKanban = { id: string; nome: string; cor: CorKanban; ativa: boolean };

/** Usuário do sistema (auth.users, via usuarios_sistema). */
export type UsuarioSistema = { id: string; email: string; nome: string | null };

export type AtividadeQuadro = {
  id: string;
  coluna_id: string;
  titulo: string;
  descricao: string | null;
  prioridade: PrioridadeAtividade;
  responsavel_id: string | null;
  prazo: string | null;
  /** Ids das categorias. */
  categorias: string[];
  criado_por: string | null;
  created_at: string;
  updated_at: string;
};

/** Nome para exibir: o do cadastro, senão o e-mail. */
export function nomeUsuario(u: UsuarioSistema | undefined): string {
  if (!u) return "Usuário removido";
  return u.nome || u.email;
}

/** Até duas iniciais ("joao.silva@..." → "JS"). */
export function iniciaisUsuario(u: UsuarioSistema | undefined): string {
  if (!u) return "?";
  const base = u.nome || u.email.split("@")[0];
  const partes = base.split(/[\s._-]+/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : base.slice(0, 2);
  return letras.toUpperCase();
}

export type SituacaoPrazo = "vencido" | "hoje" | "futuro";

/** Compara "AAAA-MM-DD" com o hoje de Palmas (vindo do servidor). */
export function situacaoPrazo(prazo: string, hoje: string): SituacaoPrazo {
  if (prazo < hoje) return "vencido";
  return prazo === hoje ? "hoje" : "futuro";
}

// ===========================================================================
// Filtros do quadro (no navegador; ?q, ?categoria, ?prioridade, ?responsavel)
// ===========================================================================

/** Valor de ?responsavel para atividades sem responsável. */
export const SEM_RESPONSAVEL = "nenhum";

export type FiltrosQuadro = {
  q: string;
  categoria: string;
  prioridade: string;
  responsavel: string;
};

export const FILTROS_VAZIOS: FiltrosQuadro = { q: "", categoria: "", prioridade: "", responsavel: "" };

export const temFiltro = (f: FiltrosQuadro) =>
  Boolean(f.q || f.categoria || f.prioridade || f.responsavel);

/** A atividade passa nos filtros? Busca sem acento no título e na descrição. */
export function passaNosFiltros(a: AtividadeQuadro, f: FiltrosQuadro): boolean {
  if (f.prioridade && a.prioridade !== f.prioridade) return false;
  if (f.categoria && !a.categorias.includes(f.categoria)) return false;
  if (f.responsavel === SEM_RESPONSAVEL) {
    if (a.responsavel_id) return false;
  } else if (f.responsavel && a.responsavel_id !== f.responsavel) {
    return false;
  }
  const termo = normalizarBusca(f.q);
  if (termo && !normalizarBusca(`${a.titulo} ${a.descricao ?? ""}`).includes(termo)) return false;
  return true;
}
