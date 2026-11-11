/** Máximo de linhas por relatório; acima disso, pedimos para refinar os filtros. */
export const LIMITE_LINHAS = 5000;

export const MSG_LIMITE =
  "O relatório passaria de 5.000 linhas. Refine os filtros e tente novamente.";

/**
 * O PDF tem limite menor: o react-pdf leva ~4 ms por linha, e a função da
 * Netlify é encerrada em 10 s (padrão). O Excel continua indo até 5.000.
 */
export const LIMITE_LINHAS_PDF = 1000;

export const msgLimitePdf = (linhas: number) =>
  `O PDF aceita até 1.000 linhas e este relatório tem ${linhas.toLocaleString("pt-BR")}. ` +
  "Refine os filtros ou exporte em Excel (até 5.000 linhas).";

export const FORMATOS = ["pdf", "xlsx"] as const;
export type Formato = (typeof FORMATOS)[number];

/** Relatórios disponíveis em /api/relatorios/[tipo]. */
export const TIPOS_RELATORIO = [
  "inventario",
  "dispositivos-por-loja",
  "historico-dispositivo",
  "historico-usuario",
  "movimentacoes",
  "vinculos-sem-termo",
  "servicos",
] as const;
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number];

/** Datas são instantes reais; cada gerador exibe no fuso de Palmas. */
export type Valor = string | number | Date | null;
export type Linha = Record<string, Valor>;

export type Coluna = {
  chave: string;
  titulo: string;
  /** moeda: número em reais (R$ 1.250,00). */
  tipo?: "texto" | "data" | "dataHora" | "numero" | "moeda";
  /** Largura relativa no PDF (padrão 1). */
  peso?: number;
};

export type Relatorio = {
  /** Usado no nome do arquivo: gesit-<slug>-AAAA-MM-DD. */
  slug: string;
  titulo: string;
  /** Nome da aba no Excel (até 31 caracteres). */
  aba: string;
  orientacao: "retrato" | "paisagem";
  /** Filtros aplicados (ou dados do item, nos históricos). */
  filtros: { rotulo: string; valor: string }[];
  /** Colunas do Excel (e do PDF, se `colunasPdf` não for informado). */
  colunas: Coluna[];
  /**
   * Colunas só do PDF, quando ele deve ser mais enxuto que o Excel. As chaves
   * podem ser campos extras das linhas (o Excel só lê as de `colunas`).
   */
  colunasPdf?: Coluna[];
  /** Já na ordem de exibição. */
  linhas: Linha[];
  /** Agrupa linhas consecutivas por esta coluna, com subtotal por grupo. */
  agruparPor?: string;
  /** Texto quando não há linhas. */
  vazio: string;
};

export type MetaRelatorio = {
  geradoEm: Date;
  /** E-mail de quem gerou. */
  geradoPor: string;
};

/** Erro com mensagem para o usuário e status HTTP. */
export class ErroRelatorio extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Grupos consecutivos de `linhas` pela coluna `chave`. */
export function agrupar(linhas: Linha[], chave: string) {
  const grupos: { titulo: string; linhas: Linha[] }[] = [];
  for (const linha of linhas) {
    const titulo = String(linha[chave] ?? "—");
    const atual = grupos.at(-1);
    if (atual && atual.titulo === titulo) atual.linhas.push(linha);
    else grupos.push({ titulo, linhas: [linha] });
  }
  return grupos;
}

/** "1 dispositivo" / "3 dispositivos". */
export function contar(n: number, singular: string, plural: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : plural}`;
}
