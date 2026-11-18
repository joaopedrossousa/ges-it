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
 * Classes por cor (tokens --coluna-* e --etiqueta-* em globals.css), em tons
 * pastel. Escritas por extenso para o Tailwind encontrá-las: nunca montar
 * `bg-${cor}`. `coluna`: fundo e borda da coluna inteira; `etiqueta`: selo do
 * título da coluna e etiquetas de categoria (texto ≥ 4,5:1); `amostra`:
 * quadradinho que identifica a cor em listas e menus.
 */
export const CLASSES_COR: Record<CorKanban, { coluna: string; etiqueta: string; amostra: string }> = {
  cinza: {
    coluna: "bg-coluna-cinza border-coluna-cinza-borda",
    etiqueta: "bg-etiqueta-cinza text-etiqueta-cinza-texto",
    amostra: "bg-etiqueta-cinza border-coluna-cinza-borda",
  },
  marrom: {
    coluna: "bg-coluna-marrom border-coluna-marrom-borda",
    etiqueta: "bg-etiqueta-marrom text-etiqueta-marrom-texto",
    amostra: "bg-etiqueta-marrom border-coluna-marrom-borda",
  },
  laranja: {
    coluna: "bg-coluna-laranja border-coluna-laranja-borda",
    etiqueta: "bg-etiqueta-laranja text-etiqueta-laranja-texto",
    amostra: "bg-etiqueta-laranja border-coluna-laranja-borda",
  },
  amarelo: {
    coluna: "bg-coluna-amarelo border-coluna-amarelo-borda",
    etiqueta: "bg-etiqueta-amarelo text-etiqueta-amarelo-texto",
    amostra: "bg-etiqueta-amarelo border-coluna-amarelo-borda",
  },
  verde: {
    coluna: "bg-coluna-verde border-coluna-verde-borda",
    etiqueta: "bg-etiqueta-verde text-etiqueta-verde-texto",
    amostra: "bg-etiqueta-verde border-coluna-verde-borda",
  },
  ciano: {
    coluna: "bg-coluna-ciano border-coluna-ciano-borda",
    etiqueta: "bg-etiqueta-ciano text-etiqueta-ciano-texto",
    amostra: "bg-etiqueta-ciano border-coluna-ciano-borda",
  },
  azul: {
    coluna: "bg-coluna-azul border-coluna-azul-borda",
    etiqueta: "bg-etiqueta-azul text-etiqueta-azul-texto",
    amostra: "bg-etiqueta-azul border-coluna-azul-borda",
  },
  roxo: {
    coluna: "bg-coluna-roxo border-coluna-roxo-borda",
    etiqueta: "bg-etiqueta-roxo text-etiqueta-roxo-texto",
    amostra: "bg-etiqueta-roxo border-coluna-roxo-borda",
  },
  rosa: {
    coluna: "bg-coluna-rosa border-coluna-rosa-borda",
    etiqueta: "bg-etiqueta-rosa text-etiqueta-rosa-texto",
    amostra: "bg-etiqueta-rosa border-coluna-rosa-borda",
  },
  vermelho: {
    coluna: "bg-coluna-vermelho border-coluna-vermelho-borda",
    etiqueta: "bg-etiqueta-vermelho text-etiqueta-vermelho-texto",
    amostra: "bg-etiqueta-vermelho border-coluna-vermelho-borda",
  },
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
  prioridade: PrioridadeAtividade;
  responsavel_id: string | null;
  prazo: string | null;
  /** Ids das categorias. */
  categorias: string[];
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  /** Flag "Urgente" (migration 022): quem marcou e quando. */
  urgente: boolean;
  urgente_por: string | null;
  urgente_em: string | null;
  /** Comentários não removidos (vw_kanban_comentarios_contagem). */
  comentarios: number;
};

/** Comentário do painel (GET /api/atividades/comentarios). */
export type ComentarioAtividade = {
  id: string;
  texto: string | null;
  autor_id: string | null;
  created_at: string;
  editado_em: string | null;
  anexos: { id: string; nome: string }[];
};

/** Imagem do comentário: URL assinada de 60 s gerada no clique/carga. */
export const urlAnexoComentario = (id: string) => `/api/atividades/anexo?id=${id}`;

/** Nome para exibir: o do cadastro, senão o e-mail. */
export function nomeUsuario(u: UsuarioSistema | undefined): string {
  if (!u) return "Usuário removido";
  return u.nome || u.email;
}

/**
 * Nome curto para espaços estreitos (cartão, tela Início): o nome do
 * cadastro; sem ele, a parte do e-mail antes do @ com iniciais maiúsculas
 * ("thiago.bertoldo@..." → "Thiago Bertoldo"). O e-mail completo fica no
 * title (tituloUsuario) e no painel.
 */
export function nomeCurtoUsuario(u: UsuarioSistema | undefined): string {
  if (!u) return "Usuário removido";
  if (u.nome) return u.nome;
  const local = u.email.split("@")[0] ?? u.email;
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ") || u.email
  );
}

/** Texto do tooltip: "Nome (e-mail)" ou só o e-mail. */
export function tituloUsuario(u: UsuarioSistema | undefined): string | undefined {
  if (!u) return undefined;
  return u.nome ? `${u.nome} (${u.email})` : u.email;
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
// Filtros do quadro (no navegador; ?q, ?categoria, ?prioridade, ?responsavel, ?urgente)
// ===========================================================================

/** Valor de ?responsavel para atividades sem responsável. */
export const SEM_RESPONSAVEL = "nenhum";

export type FiltrosQuadro = {
  q: string;
  categoria: string;
  prioridade: string;
  responsavel: string;
  /** "1" = só urgentes. */
  urgente: string;
};

export const FILTROS_VAZIOS: FiltrosQuadro = {
  q: "",
  categoria: "",
  prioridade: "",
  responsavel: "",
  urgente: "",
};

export const temFiltro = (f: FiltrosQuadro) =>
  Boolean(f.q || f.categoria || f.prioridade || f.responsavel || f.urgente);

/** A atividade passa nos filtros? Busca sem acento no título. */
export function passaNosFiltros(a: AtividadeQuadro, f: FiltrosQuadro): boolean {
  if (f.urgente && !a.urgente) return false;
  if (f.prioridade && a.prioridade !== f.prioridade) return false;
  if (f.categoria && !a.categorias.includes(f.categoria)) return false;
  if (f.responsavel === SEM_RESPONSAVEL) {
    if (a.responsavel_id) return false;
  } else if (f.responsavel && a.responsavel_id !== f.responsavel) {
    return false;
  }
  const termo = normalizarBusca(f.q);
  if (termo && !normalizarBusca(a.titulo).includes(termo)) return false;
  return true;
}
