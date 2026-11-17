import { ArchiveXIcon } from "lucide-react";

import { CampoDetalhe } from "@/components/campo-detalhe";
import { GaleriaAnexos, type ItemGaleria } from "@/components/galeria-anexos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDataHora, formatarDataISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { MOTIVO_BAIXA_LABEL } from "@/lib/types";

/**
 * Bloco "Baixa" do detalhe do dispositivo baixado (migration 019): motivo,
 * informações, data, autor e anexos. Baixados antes da 019 não têm registro.
 */
export async function SecaoBaixa({ dispositivoId }: { dispositivoId: string }) {
  const supabase = await createClient();
  const { data: baixa, error } = await supabase
    .from("dispositivo_baixas")
    .select(
      "id, motivo, informacoes, data_baixa, criado_por, created_at, anexos:dispositivo_baixa_anexos(id, path, nome_arquivo, created_at)",
    )
    .eq("dispositivo_id", dispositivoId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar a baixa:", error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Baixa</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Não foi possível carregar a baixa.</p>
        </CardContent>
      </Card>
    );
  }

  if (!baixa) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArchiveXIcon className="size-4 text-muted-foreground" aria-hidden />
            Baixa
          </CardTitle>
          <CardDescription>
            Baixado antes do formulário de baixa: sem motivo, informações nem anexos registrados.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  let autor = "—";
  if (baixa.criado_por) {
    const { data } = await supabase.rpc("emails_operadores", { p_ids: [baixa.criado_por] });
    autor = data?.[0]?.email ?? "Usuário não encontrado";
  }

  const anexos: ItemGaleria[] = [...baixa.anexos]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((a) => ({
      chave: a.id,
      nome: a.nome_arquivo,
      tipo: a.path.endsWith(".pdf") ? "pdf" : "imagem",
      url: `/api/baixas/anexo?id=${a.id}`,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArchiveXIcon className="size-4 text-muted-foreground" aria-hidden />
          Baixa
        </CardTitle>
        <CardDescription>Registro definitivo da baixa deste dispositivo.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CampoDetalhe rotulo="Motivo">{MOTIVO_BAIXA_LABEL[baixa.motivo]}</CampoDetalhe>
          <CampoDetalhe rotulo="Data da baixa">{formatarDataISO(baixa.data_baixa)}</CampoDetalhe>
          <CampoDetalhe rotulo="Registrada por">{autor}</CampoDetalhe>
          <CampoDetalhe rotulo="Registrada em">{formatarDataHora(baixa.created_at)}</CampoDetalhe>
          <div className="sm:col-span-2 lg:col-span-4">
            <CampoDetalhe rotulo="Informações da baixa">
              <span className="whitespace-pre-line">{baixa.informacoes}</span>
            </CampoDetalhe>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <CampoDetalhe rotulo="Anexos">
              {anexos.length === 0 ? (
                <span className="text-muted-foreground">Nenhum anexo.</span>
              ) : (
                <GaleriaAnexos itens={anexos} className="mt-1" />
              )}
            </CampoDetalhe>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
