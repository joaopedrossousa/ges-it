/**
 * CPF e e-mail são opcionais (migration 013); faltar um deles = dados
 * pendentes. Mesma regra no selo, no card do Dashboard e no filtro da listagem.
 * O cargo também é opcional, mas não é pendência: só aparece, como informação,
 * na coluna "Dados Pendentes" do relatório "colaboradores" (camposEmBranco).
 */
type ComContato = { cpf: string | null; email: string | null };

/** Campos pendentes, na ordem de exibição: ["CPF", "E-mail"]. */
export function camposPendentes(c: ComContato): string[] {
  return [!c.cpf && "CPF", !c.email && "E-mail"].filter((x): x is string => Boolean(x));
}

/**
 * Para o relatório: os pendentes e, depois, o cargo em branco (informativo,
 * não conta como pendência): ["CPF", "E-mail", "Cargo"].
 */
export function camposEmBranco(c: ComContato & { cargo: string | null }): string[] {
  return [...camposPendentes(c), ...(c.cargo ? [] : ["Cargo"])];
}

/** "Sem CPF", "Sem e-mail" ou "Sem CPF e sem e-mail"; "" se completo. */
export function descreverPendencias(c: ComContato): string {
  const partes = camposPendentes(c).map((p) => (p === "CPF" ? p : p.toLowerCase()));
  return partes.length ? `Sem ${partes.join(" e sem ")}` : "";
}

/** Filtro do PostgREST (dentro de .or) para quem tem dados pendentes. */
export const FILTRO_DADOS_PENDENTES = "cpf.is.null,email.is.null";

/** Filtro de situação da listagem (?situacao=); sem parâmetro = "ativos". */
export const SITUACOES_COLABORADOR = ["ativos", "inativos", "todos", "pendentes"] as const;
export type SituacaoColaborador = (typeof SITUACOES_COLABORADOR)[number];
export const SITUACAO_PADRAO: SituacaoColaborador = "ativos";

/** Opções do select de situação (listagem e tela Relatórios): texto de opção, em frase. */
export const OPCOES_SITUACAO_COLABORADOR: { value: SituacaoColaborador; label: string }[] = [
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
  { value: "todos", label: "Todos" },
  { value: "pendentes", label: "Dados pendentes" },
];
