import { NextResponse, type NextRequest } from "next/server";

import { hojeEmPalmas } from "@/lib/format";
import { GERADORES } from "@/lib/relatorios/dados";
import { gerarExcel } from "@/lib/relatorios/excel";
import { gerarPdf } from "@/lib/relatorios/pdf";
import {
  ErroRelatorio,
  FORMATOS,
  LIMITE_LINHAS_PDF,
  TIPOS_RELATORIO,
  msgLimitePdf,
  type Formato,
  type TipoRelatorio,
} from "@/lib/relatorios/tipos";
import { createClient } from "@/lib/supabase/server";

const CONTENT_TYPE: Record<Formato, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function erro(status: number, mensagem: string) {
  return NextResponse.json({ erro: mensagem }, { status, headers: { "Cache-Control": "no-store" } });
}

const ehTipo = (v: string): v is TipoRelatorio => (TIPOS_RELATORIO as readonly string[]).includes(v);
const ehFormato = (v: string | null): v is Formato => (FORMATOS as readonly (string | null)[]).includes(v);

/**
 * GET /api/relatorios/<tipo>?formato=pdf|xlsx&<filtros>
 * Gera o relatório no servidor com a sessão de quem pediu (RLS do Supabase);
 * nenhuma chave secreta. O proxy já exige login; a checagem abaixo garante
 * resposta JSON (401) para o fetch do botão e dá o e-mail de quem gerou.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/relatorios/[tipo]">) {
  const { tipo } = await ctx.params;
  const params = request.nextUrl.searchParams;
  const formato = params.get("formato");

  if (!ehTipo(tipo)) return erro(404, "Relatório não encontrado.");
  if (!ehFormato(formato)) return erro(400, "Formato inválido. Use PDF ou Excel.");

  const supabase = await createClient();
  const { data: sessao } = await supabase.auth.getClaims();
  if (!sessao?.claims) return erro(401, "Sua sessão expirou. Entre novamente.");
  const email = typeof sessao.claims.email === "string" ? sessao.claims.email : "usuário";

  const agora = new Date();
  try {
    const relatorio = await GERADORES[tipo](supabase, params, agora);
    if (formato === "pdf" && relatorio.linhas.length > LIMITE_LINHAS_PDF) {
      return erro(422, msgLimitePdf(relatorio.linhas.length));
    }

    const meta = { geradoEm: agora, geradoPor: email };
    const arquivo = formato === "pdf" ? await gerarPdf(relatorio, meta) : await gerarExcel(relatorio, meta);
    const nome = `gesit-${relatorio.slug}-${hojeEmPalmas(agora)}.${formato}`;

    return new Response(new Uint8Array(arquivo), {
      headers: {
        "Content-Type": CONTENT_TYPE[formato],
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ErroRelatorio) return erro(e.status, e.message);
    console.error(`Erro ao gerar relatório ${tipo} (${formato}):`, e);
    return erro(500, "Não foi possível gerar o relatório. Tente novamente.");
  }
}
