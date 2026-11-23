import {
  ACAO_LABEL,
  TIPO_REGISTRO_LABEL,
  descreverAlteracoes,
  ehAcaoAuditoria,
  ehTabelaAuditoria,
  type AcaoAuditoria,
  type Alteracao,
  type NomesAuditoria,
} from "@/lib/auditoria";
import { nomeCurtoUsuario, nomeUsuario } from "@/lib/atividades";
import { listarUsuariosSistema } from "@/lib/atividades-servidor";
import type { Json } from "@/lib/database.types";
import { descricaoDispositivo } from "@/lib/dispositivos";
import { formatarCompetenciaCurta, nomeFinanceiro } from "@/lib/financeiro";
import { limitesPeriodo, type FiltrosAuditoria } from "@/lib/filtros-auditoria";
import type { createClient } from "@/lib/supabase/server";
import { MOMENTO_IMAGEM_LABEL, TIPO_SERVICO_LABEL } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const SELECT_AUDITORIA =
  "id, tabela, registro_id, acao, alterado_por, alterado_em, antes, depois, campos_alterados";

/** Consulta de auditoria com os filtros, do mais recente para o mais antigo. */
export function consultaAuditoria(supabase: Supabase, f: FiltrosAuditoria, contar = false) {
  const { desde, antesDe } = limitesPeriodo(f);
  let q = supabase
    .from("auditoria")
    .select(SELECT_AUDITORIA, contar ? { count: "exact" } : undefined)
    .order("alterado_em", { ascending: false })
    .order("id", { ascending: false });
  if (desde) q = q.gte("alterado_em", desde);
  if (antesDe) q = q.lt("alterado_em", antesDe);
  if (f.usuario) q = q.eq("alterado_por", f.usuario);
  if (f.tabela) q = q.eq("tabela", f.tabela);
  if (f.acao) q = q.eq("acao", f.acao);
  if (f.registro) q = q.eq("registro_id", f.registro);
  return q;
}

export type LinhaAuditoriaBruta = {
  id: number;
  tabela: string;
  registro_id: string;
  acao: string;
  alterado_por: string | null;
  alterado_em: string;
  antes: Json | null;
  depois: Json | null;
  campos_alterados: string[];
};

/** Linha pronta para a tela e para o Excel. */
export type LinhaAuditoria = {
  id: number;
  quando: string;
  /** Nome de exibição de quem fez (Administração > Usuários). */
  usuario: string;
  /** E-mail de quem fez (tooltip e Excel). */
  usuarioEmail: string | null;
  acao: string;
  codigoAcao: AcaoAuditoria;
  tipoRegistro: string;
  registro: { texto: string; href: string | null };
  alteracoes: Alteracao[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids referenciados em antes/depois (loja_id, colaborador_id, dispositivo_id). */
function idsDoCampo(linhas: LinhaAuditoriaBruta[], campo: string) {
  const ids: string[] = [];
  for (const l of linhas) {
    for (const j of [l.antes, l.depois]) {
      if (j && typeof j === "object" && !Array.isArray(j)) {
        const v = j[campo];
        if (typeof v === "string" && UUID.test(v)) ids.push(v);
      }
    }
  }
  return ids;
}

/** Ids dentro de listas em antes/depois (ex.: categorias das atividades). */
function idsDaLista(linhas: LinhaAuditoriaBruta[], campo: string) {
  const ids: string[] = [];
  for (const l of linhas) {
    for (const j of [l.antes, l.depois]) {
      if (j && typeof j === "object" && !Array.isArray(j)) {
        const v = j[campo];
        if (Array.isArray(v)) {
          for (const x of v) if (typeof x === "string" && UUID.test(x)) ids.push(x);
        }
      }
    }
  }
  return ids;
}

const unicos = (ids: (string | null | undefined)[]) =>
  [...new Set(ids.filter((x): x is string => Boolean(x)))];

/** Ids por consulta: o filtro in.(...) vai na URL, que tem limite de tamanho. */
const LOTE_IDS = 150;

/** Roda a consulta em lotes de ids e junta os resultados. */
async function emLotes<T>(
  ids: string[],
  consulta: (lote: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += LOTE_IDS) lotes.push(ids.slice(i, i + LOTE_IDS));
  const respostas = await Promise.all(lotes.map((lote) => consulta(lote)));
  return respostas.flatMap(({ data, error }) => {
    if (error) throw new Error(error.message);
    return data ?? [];
  });
}

/**
 * Carrega, em poucas consultas, os nomes que o log precisa mostrar
 * (registros, ids citados nas alterações e e-mails de quem fez) e monta as
 * linhas. Registros de vínculo e serviço aparecem pelo dispositivo.
 */
export async function montarLinhasAuditoria(
  supabase: Supabase,
  linhas: LinhaAuditoriaBruta[],
): Promise<LinhaAuditoria[]> {
  const porTabela = (t: string) => unicos(linhas.filter((l) => l.tabela === t).map((l) => l.registro_id));

  // 1ª etapa (tudo em paralelo; só depende das linhas do log):
  // - Vínculos, serviços e imagens apontam para dispositivos/colaboradores:
  //   busca-os antes dos nomes. Imagens: o dispositivo e o momento vêm da
  //   própria linha (a remoção só traz removida/removida_em no log).
  // - Comentários: a atividade vem da própria linha (edição e remoção não a
  //   trazem no log).
  // - Lançamentos aparecem pela descrição e competência.
  // - Nomes de exibição de todos os usuários do sistema (Administração >
  //   Usuários): quem fez, responsável, quem marcou urgente e perfis.
  const [imagensLista, comentariosLista, vinculosLista, servicosLista, lancamentosLista, usuariosSistema] = await Promise.all([
    emLotes(porTabela("dispositivo_imagens"), (lote) =>
      supabase.from("dispositivo_imagens").select("id, dispositivo_id, momento").in("id", lote),
    ),
    emLotes(porTabela("kanban_comentarios"), (lote) =>
      supabase.from("kanban_comentarios").select("id, atividade_id").in("id", lote),
    ),
    emLotes(unicos([...porTabela("vinculos"), ...idsDoCampo(linhas, "vinculo_id")]), (lote) =>
      supabase.from("vinculos").select("id, dispositivo_id, colaborador_id").in("id", lote),
    ),
    emLotes(porTabela("servicos"), (lote) =>
      supabase.from("servicos").select("id, dispositivo_id, tipo").in("id", lote),
    ),
    emLotes(porTabela("lancamentos"), (lote) =>
      supabase
        .from("lancamentos")
        .select("id, fornecedor, descricao, competencia")
        .in("id", lote),
    ),
    // Cache da requisição: o filtro de usuários da tela já buscou a mesma lista.
    listarUsuariosSistema(),
  ]);
  const imagensMap = new Map(imagensLista.map((i) => [i.id, i]));
  const comentariosMap = new Map(comentariosLista.map((c) => [c.id, c]));
  const vinculos = new Map(vinculosLista.map((v) => [v.id, v]));
  const servicos = new Map(servicosLista.map((s) => [s.id, s]));
  const lancamentos = new Map(lancamentosLista.map((l) => [l.id, l]));

  const idsLojas = unicos([...porTabela("lojas"), ...idsDoCampo(linhas, "loja_id"), ...idsDoCampo(linhas, "loja_estoque_id")]);
  const idsColaboradores = unicos([
    ...porTabela("colaboradores"),
    ...idsDoCampo(linhas, "colaborador_id"),
    ...vinculosLista.map((v) => v.colaborador_id),
  ]);
  const idsDispositivos = unicos([
    ...porTabela("dispositivos"),
    ...idsDoCampo(linhas, "dispositivo_id"),
    ...vinculosLista.map((v) => v.dispositivo_id),
    ...servicosLista.map((s) => s.dispositivo_id),
    ...imagensLista.map((i) => i.dispositivo_id),
  ]);
  const idsServicosFinanceiros = unicos([
    ...porTabela("servicos_financeiros"),
    ...idsDoCampo(linhas, "servico_id"),
  ]);
  const idsUsuarios = unicos(linhas.map((l) => l.alterado_por));
  const idsAtividades = unicos([
    ...porTabela("kanban_atividades"),
    ...comentariosLista.map((c) => c.atividade_id),
  ]);
  const idsColunasKanban = unicos([...porTabela("kanban_colunas"), ...idsDoCampo(linhas, "coluna_id")]);
  const idsCategoriasKanban = unicos([
    ...porTabela("kanban_categorias"),
    ...idsDaLista(linhas, "categorias"),
  ]);
  // 2ª etapa: os nomes de tudo o que foi citado.
  const [
    lojas,
    colaboradores,
    dispositivos,
    servicosFinanceiros,
    usuarios,
    atividadesLista,
    colunasKanban,
    categoriasKanban,
  ] = await Promise.all([
    emLotes(idsLojas, (lote) => supabase.from("lojas").select("id, nome").in("id", lote)),
    emLotes(idsColaboradores, (lote) =>
      supabase.from("colaboradores").select("id, nome").in("id", lote),
    ),
    emLotes(idsDispositivos, (lote) =>
      supabase
        .from("dispositivos")
        .select("id, tipo, marca, modelo, equipamento, serial_number, imei1, numero_patrimonio")
        .in("id", lote),
    ),
    emLotes(idsServicosFinanceiros, (lote) =>
      supabase
        .from("servicos_financeiros")
        .select("id, fornecedor, descricao, identificador")
        .in("id", lote),
    ),
    // Corpo POST: sem limite de URL, mas mantém os lotes por simetria.
    emLotes(idsUsuarios, (lote) => supabase.rpc("emails_operadores", { p_ids: lote })),
    emLotes(idsAtividades, (lote) =>
      supabase.from("kanban_atividades").select("id, titulo, arquivada").in("id", lote),
    ),
    emLotes(idsColunasKanban, (lote) =>
      supabase.from("kanban_colunas").select("id, nome").in("id", lote),
    ),
    emLotes(idsCategoriasKanban, (lote) =>
      supabase.from("kanban_categorias").select("id, nome").in("id", lote),
    ),
  ]);
  const atividades = new Map(atividadesLista.map((a) => [a.id, a]));

  const nomes: NomesAuditoria = {
    lojas: new Map(lojas.map((l) => [l.id, l.nome])),
    colaboradores: new Map(colaboradores.map((c) => [c.id, c.nome])),
    dispositivos: new Map(dispositivos.map((d) => [d.id, descricaoDispositivo(d)])),
    atividades: new Map(atividadesLista.map((a) => [a.id, a.titulo])),
    vinculos: new Map(
      vinculosLista.map((v) => [
        v.id,
        colaboradores.find((c) => c.id === v.colaborador_id)?.nome ?? "Colaborador não encontrado",
      ]),
    ),
    servicosFinanceiros: new Map(
      servicosFinanceiros.map((s) => [s.id, nomeFinanceiro(s)]),
    ),
    colunasKanban: new Map(colunasKanban.map((c) => [c.id, c.nome])),
    categoriasKanban: new Map(categoriasKanban.map((c) => [c.id, c.nome])),
    usuarios: new Map(
      usuariosSistema.map((u) => [u.id, nomeUsuario({ ...u, nome: u.nome || null })]),
    ),
  };
  const emails = new Map(usuarios.map((u) => [u.id, u.email]));
  const emailDe = new Map(usuariosSistema.map((u) => [u.id, u.email]));

  const dispositivo = (id: string | undefined) => ({
    texto: (id && nomes.dispositivos.get(id)) || "Dispositivo não encontrado",
    href: id ? `/dispositivos/${id}` : null,
  });

  function registro(l: LinhaAuditoriaBruta): LinhaAuditoria["registro"] {
    switch (l.tabela) {
      case "colaboradores":
        return {
          texto: nomes.colaboradores.get(l.registro_id) ?? "Colaborador não encontrado",
          href: `/colaboradores/${l.registro_id}`,
        };
      case "dispositivos":
        return dispositivo(l.registro_id);
      case "lojas":
        return { texto: nomes.lojas.get(l.registro_id) ?? "Loja não encontrada", href: "/lojas" };
      case "vinculos": {
        const v = vinculos.get(l.registro_id);
        const d = dispositivo(v?.dispositivo_id);
        const c = v ? nomes.colaboradores.get(v.colaborador_id) : undefined;
        return { texto: c ? `${d.texto} → ${c}` : d.texto, href: d.href };
      }
      case "dispositivo_imagens": {
        const i = imagensMap.get(l.registro_id);
        const d = dispositivo(i?.dispositivo_id);
        return {
          texto: i ? `Imagem (${MOMENTO_IMAGEM_LABEL[i.momento]}) · ${d.texto}` : d.texto,
          href: d.href ? `${d.href}#imagens` : null,
        };
      }
      case "servicos": {
        const s = servicos.get(l.registro_id);
        const d = dispositivo(s?.dispositivo_id);
        return { texto: s ? `${TIPO_SERVICO_LABEL[s.tipo]} · ${d.texto}` : d.texto, href: d.href };
      }
      case "servicos_financeiros":
        return {
          texto: nomes.servicosFinanceiros.get(l.registro_id) ?? "Serviço não encontrado",
          href: "/financeiro/servicos",
        };
      case "lancamentos": {
        const la = lancamentos.get(l.registro_id);
        if (!la) return { texto: "Lançamento não encontrado", href: null };
        return {
          texto: `${nomeFinanceiro(la)} · ${formatarCompetenciaCurta(la.competencia)}`,
          href: `/financeiro/lancamentos?mes=${la.competencia.slice(0, 7)}`,
        };
      }
      case "kanban_atividades": {
        const a = atividades.get(l.registro_id);
        if (!a) return { texto: "Atividade não encontrada", href: null };
        return a.arquivada
          ? { texto: `${a.titulo} (concluída)`, href: "/atividades/concluidas" }
          : { texto: a.titulo, href: `/atividades?atividade=${a.id}` };
      }
      case "kanban_comentarios": {
        const c = comentariosMap.get(l.registro_id);
        const a = c ? atividades.get(c.atividade_id) : undefined;
        if (!a) return { texto: "Comentário de atividade não encontrada", href: null };
        return a.arquivada
          ? { texto: `Comentário · ${a.titulo} (concluída)`, href: "/atividades/concluidas" }
          : { texto: `Comentário · ${a.titulo}`, href: `/atividades?atividade=${a.id}` };
      }
      case "perfis_usuarios":
        return {
          texto: nomes.usuarios.get(l.registro_id)
            ? `${nomes.usuarios.get(l.registro_id)} (${emailDe.get(l.registro_id) ?? "e-mail não encontrado"})`
            : "Usuário do sistema removido",
          href: "/administracao/usuarios",
        };
      case "kanban_colunas":
        return {
          texto: nomes.colunasKanban.get(l.registro_id) ?? "Coluna não encontrada",
          href: "/atividades",
        };
      case "kanban_categorias":
        return {
          texto: nomes.categoriasKanban.get(l.registro_id) ?? "Categoria não encontrada",
          href: "/atividades/categorias",
        };
      default:
        return { texto: l.registro_id, href: null };
    }
  }

  return linhas.flatMap((l) => {
    if (!ehTabelaAuditoria(l.tabela) || !ehAcaoAuditoria(l.acao)) return [];
    return [
      {
        id: l.id,
        quando: l.alterado_em,
        usuario: l.alterado_por
          ? (nomes.usuarios.get(l.alterado_por) ??
            (emails.get(l.alterado_por)
              ? nomeCurtoUsuario({ id: l.alterado_por, email: emails.get(l.alterado_por) ?? "", nome: null })
              : "Usuário removido"))
          : "Sistema (fora do app)",
        usuarioEmail: l.alterado_por ? (emailDe.get(l.alterado_por) ?? emails.get(l.alterado_por) ?? null) : null,
        acao: ACAO_LABEL[l.acao],
        codigoAcao: l.acao,
        tipoRegistro: TIPO_REGISTRO_LABEL[l.tabela],
        registro: registro(l),
        alteracoes: descreverAlteracoes({ ...l, tabela: l.tabela, acao: l.acao }, nomes),
      },
    ];
  });
}
