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
import type { Json } from "@/lib/database.types";
import { descricaoDispositivo } from "@/lib/dispositivos";
import { limitesPeriodo, type FiltrosAuditoria } from "@/lib/filtros-auditoria";
import type { createClient } from "@/lib/supabase/server";
import { TIPO_SERVICO_LABEL } from "@/lib/types";

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
  usuario: string;
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

  // Vínculos e serviços apontam para dispositivos/usuários: busca-os primeiro.
  const [vinculosLista, servicosLista] = await Promise.all([
    emLotes(porTabela("vinculos"), (lote) =>
      supabase.from("vinculos").select("id, dispositivo_id, colaborador_id").in("id", lote),
    ),
    emLotes(porTabela("servicos"), (lote) =>
      supabase.from("servicos").select("id, dispositivo_id, tipo").in("id", lote),
    ),
  ]);
  const vinculos = new Map(vinculosLista.map((v) => [v.id, v]));
  const servicos = new Map(servicosLista.map((s) => [s.id, s]));

  const idsLojas = unicos([...porTabela("lojas"), ...idsDoCampo(linhas, "loja_id")]);
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
  ]);
  const idsUsuarios = unicos(linhas.map((l) => l.alterado_por));

  const [lojas, colaboradores, dispositivos, usuarios] = await Promise.all([
    emLotes(idsLojas, (lote) => supabase.from("lojas").select("id, nome").in("id", lote)),
    emLotes(idsColaboradores, (lote) =>
      supabase.from("colaboradores").select("id, nome").in("id", lote),
    ),
    emLotes(idsDispositivos, (lote) =>
      supabase
        .from("dispositivos")
        .select("id, tipo, marca, modelo, serial_number, imei1, numero_patrimonio")
        .in("id", lote),
    ),
    // Corpo POST: sem limite de URL, mas mantém os lotes por simetria.
    emLotes(idsUsuarios, (lote) => supabase.rpc("emails_operadores", { p_ids: lote })),
  ]);

  const nomes: NomesAuditoria = {
    lojas: new Map(lojas.map((l) => [l.id, l.nome])),
    colaboradores: new Map(colaboradores.map((c) => [c.id, c.nome])),
    dispositivos: new Map(dispositivos.map((d) => [d.id, descricaoDispositivo(d)])),
  };
  const emails = new Map(usuarios.map((u) => [u.id, u.email]));

  const dispositivo = (id: string | undefined) => ({
    texto: (id && nomes.dispositivos.get(id)) || "Dispositivo não encontrado",
    href: id ? `/dispositivos/${id}` : null,
  });

  function registro(l: LinhaAuditoriaBruta): LinhaAuditoria["registro"] {
    switch (l.tabela) {
      case "colaboradores":
        return {
          texto: nomes.colaboradores.get(l.registro_id) ?? "Usuário não encontrado",
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
      case "servicos": {
        const s = servicos.get(l.registro_id);
        const d = dispositivo(s?.dispositivo_id);
        return { texto: s ? `${TIPO_SERVICO_LABEL[s.tipo]} · ${d.texto}` : d.texto, href: d.href };
      }
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
          ? (emails.get(l.alterado_por) ?? "Usuário removido")
          : "Sistema (fora do app)",
        acao: ACAO_LABEL[l.acao],
        codigoAcao: l.acao,
        tipoRegistro: TIPO_REGISTRO_LABEL[l.tabela],
        registro: registro(l),
        alteracoes: descreverAlteracoes({ ...l, tabela: l.tabela, acao: l.acao }, nomes),
      },
    ];
  });
}
