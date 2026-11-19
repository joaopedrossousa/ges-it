/**
 * CPF, e-mail (migration 013) e cargo são opcionais; faltar um deles = dados
 * pendentes. Mesma regra no selo, no card do Dashboard, no filtro da listagem
 * e no relatório "colaboradores".
 */
type ComContato = { cpf: string | null; email: string | null; cargo: string | null };

/** Campos que faltam, na ordem de exibição: ["CPF", "E-mail", "Cargo"]. */
export function camposPendentes(c: ComContato): string[] {
  return [!c.cpf && "CPF", !c.email && "E-mail", !c.cargo && "Cargo"].filter(
    (x): x is string => Boolean(x),
  );
}

/** "Sem CPF", "Sem CPF e sem e-mail", "Sem CPF, sem e-mail e sem cargo"; "" se completo. */
export function descreverPendencias(c: ComContato): string {
  const partes = camposPendentes(c).map((p) => (p === "CPF" ? p : p.toLowerCase()));
  if (!partes.length) return "";
  const ultimo = partes.pop()!;
  return partes.length ? `Sem ${partes.join(", sem ")} e sem ${ultimo}` : `Sem ${ultimo}`;
}

/** Filtro do PostgREST (dentro de .or) para quem tem dados pendentes. */
export const FILTRO_DADOS_PENDENTES = "cpf.is.null,email.is.null,cargo.is.null";

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
