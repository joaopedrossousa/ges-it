"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { erroDoBanco, errosDoZod, type ActionResult } from "@/lib/action-result";
import { REGEX_CAMINHO_ANEXO } from "@/lib/anexos";
import { SITUACAO_PAGAMENTO_LABEL, nomeFinanceiro } from "@/lib/financeiro";
import { createClient } from "@/lib/supabase/server";
import {
  lancamentoSchema,
  servicoFinanceiroSchema,
  situacaoLancamentoSchema,
  type LancamentoFormInput,
  type ServicoFinanceiroFormInput,
  type SituacaoLancamentoInput,
} from "@/lib/validators";

const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Painel, lançamentos e catálogo leem as mesmas tabelas. */
function revalidar() {
  revalidatePath("/financeiro", "layout");
}

// ===========================================================================
// Catálogo de serviços
// ===========================================================================

type CampoServicoFinanceiro = keyof ServicoFinanceiroFormInput;

export async function criarServicoFinanceiro(
  input: ServicoFinanceiroFormInput,
): Promise<ActionResult<CampoServicoFinanceiro>> {
  const parsed = servicoFinanceiroSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("servicos_financeiros").insert(parsed.data);
  if (error) return erroDoBanco(error);

  revalidar();
  return { ok: true };
}

export async function atualizarServicoFinanceiro(
  id: string,
  input: ServicoFinanceiroFormInput,
): Promise<ActionResult<CampoServicoFinanceiro>> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Serviço inválido." };
  const parsed = servicoFinanceiroSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("servicos_financeiros")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { ok: false, error: "Serviço não encontrado." };

  revalidar();
  return { ok: true };
}

// ===========================================================================
// Lançamentos
// ===========================================================================

type CampoLancamento = keyof LancamentoFormInput;

/**
 * `duplicado`: já há lançamento do mesmo serviço na competência. Nada foi
 * salvo; o formulário mostra o aviso e reenvia com a confirmação.
 */
export type ResultadoLancamento =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<CampoLancamento, string>> }
  | { ok: false; error: string; duplicado: true };

/** Os helpers devolvem ActionResult (com { ok: true }); aqui só falham. */
const falha = (r: ActionResult<CampoLancamento>) =>
  r as Extract<ActionResult<CampoLancamento>, { ok: false }>;

/**
 * Aviso de duplicidade (não bloqueia): outro lançamento não cancelado do
 * mesmo serviço na mesma competência.
 */
async function avisoDuplicado(
  supabase: Supabase,
  servicoId: string | null,
  competencia: string,
  ignorarId?: string,
): Promise<string | null> {
  if (!servicoId) return null;
  let q = supabase
    .from("lancamentos")
    .select("id")
    .eq("servico_id", servicoId)
    .eq("competencia", competencia)
    .neq("situacao", "cancelado")
    .limit(1);
  if (ignorarId) q = q.neq("id", ignorarId);
  const [{ data: existentes }, { data: servico }] = await Promise.all([
    q,
    supabase
      .from("servicos_financeiros")
      .select("fornecedor, descricao, identificador")
      .eq("id", servicoId)
      .maybeSingle(),
  ]);
  if (!existentes?.length) return null;
  const nome = servico ? nomeFinanceiro(servico) : "este serviço";
  return `Já existe um lançamento de ${nome} neste mês.`;
}

/** Devolve o id criado: o navegador envia o anexo depois e chama anexarArquivoLancamento. */
export async function criarLancamento(
  input: LancamentoFormInput,
  confirmarDuplicado = false,
): Promise<ResultadoLancamento> {
  const parsed = lancamentoSchema.safeParse(input);
  if (!parsed.success) return falha(errosDoZod(parsed.error));

  const supabase = await createClient();
  if (!confirmarDuplicado) {
    const aviso = await avisoDuplicado(supabase, parsed.data.servico_id, parsed.data.competencia);
    if (aviso) return { ok: false, error: aviso, duplicado: true };
  }

  const { data, error } = await supabase
    .from("lancamentos")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return falha(erroDoBanco(error));

  revalidar();
  return { ok: true, id: data.id };
}

export async function atualizarLancamento(
  id: string,
  input: LancamentoFormInput,
  confirmarDuplicado = false,
): Promise<ResultadoLancamento> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Lançamento inválido." };
  const parsed = lancamentoSchema.safeParse(input);
  if (!parsed.success) return falha(errosDoZod(parsed.error));

  const supabase = await createClient();
  const { data: atual, error: erroAtual } = await supabase
    .from("lancamentos")
    .select("servico_id, competencia")
    .eq("id", id)
    .maybeSingle();
  if (erroAtual) return falha(erroDoBanco(erroAtual));
  if (!atual) return { ok: false, error: "Lançamento não encontrado." };

  // Só avisa se o serviço ou a competência mudaram (o resto não cria duplicidade).
  const mudou =
    atual.servico_id !== parsed.data.servico_id || atual.competencia !== parsed.data.competencia;
  if (mudou && !confirmarDuplicado) {
    const aviso = await avisoDuplicado(
      supabase,
      parsed.data.servico_id,
      parsed.data.competencia,
      id,
    );
    if (aviso) return { ok: false, error: aviso, duplicado: true };
  }

  const { data, error } = await supabase
    .from("lancamentos")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return falha(erroDoBanco(error));
  if (!data?.length) return { ok: false, error: "Lançamento não encontrado." };

  revalidar();
  return { ok: true, id };
}

/** Mudança rápida na linha. Fora de "pago", a data do pagamento é apagada. */
export async function alterarSituacaoLancamento(
  id: string,
  input: SituacaoLancamentoInput,
): Promise<ActionResult<"situacao" | "data_pagamento"> & { mensagem?: string }> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Lançamento inválido." };
  const parsed = situacaoLancamentoSchema.safeParse(input);
  if (!parsed.success) return errosDoZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { ok: false, error: "Lançamento não encontrado." };

  revalidar();
  return { ok: true, mensagem: `Situação alterada para "${SITUACAO_PAGAMENTO_LABEL[parsed.data.situacao]}".` };
}

/**
 * Grava (ou substitui) o boleto/NF já enviado pelo navegador para
 * financeiro/{lancamento_id}/{timestamp}.{ext}. O banco confere a pasta
 * (check) e se o arquivo existe (trigger). O anterior fica no bucket.
 */
export async function anexarArquivoLancamento(id: string, path: string): Promise<ActionResult> {
  if (
    !idSchema.safeParse(id).success ||
    typeof path !== "string" ||
    !REGEX_CAMINHO_ANEXO.test(path) ||
    !path.startsWith(`${id}/`)
  ) {
    return { ok: false, error: "Arquivo do anexo inválido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .update({ anexo_path: path })
    .eq("id", id)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { ok: false, error: "Lançamento não encontrado." };

  revalidar();
  return { ok: true };
}
