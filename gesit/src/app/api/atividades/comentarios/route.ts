import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  COMENTARIOS_POR_PAGINA,
  VALIDADE_URL_COMENTARIOS,
  type ComentarioAtividade,
  type PaginaComentarios,
} from "@/lib/atividades";
import { createClient } from "@/lib/supabase/server";

/** Largura da miniatura (a galeria mostra 96 px; 256 cobre telas 2x). Deve estar em images.imageSizes. */
const LARGURA_MINIATURA = 256;

/** Miniatura pelo otimizador do Next (na Netlify, o Image CDN): a imagem cheia só abre ao ampliar. */
function urlMiniatura(urlAssinada: string) {
  return `/_next/image?url=${encodeURIComponent(urlAssinada)}&w=${LARGURA_MINIATURA}&q=75`;
}

const parametros = z.object({
  atividade: z.uuid(),
  // Cursor de "Carregar anteriores": o comentário mais antigo já exibido.
  antesEm: z.iso.datetime({ offset: true }).optional(),
  antesId: z.uuid().optional(),
});

/**
 * GET /api/atividades/comentarios?atividade=<id>[&antesEm=<created_at>&antesId=<id>]
 * Os COMENTARIOS_POR_PAGINA comentários não removidos mais recentes (ou os
 * anteriores ao cursor), devolvidos do mais antigo para o mais novo, com as
 * imagens não removidas. Numa consulta só: comentários e imagens juntos (os
 * autores vêm da lista de usuários que o quadro já tem). As URLs assinadas
 * das imagens saem em lote (createSignedUrls), sem uma chamada por imagem.
 * Leitura com a sessão do usuário (RLS).
 */
export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams;
  const lido = parametros.safeParse({
    atividade: busca.get("atividade"),
    antesEm: busca.get("antesEm") ?? undefined,
    antesId: busca.get("antesId") ?? undefined,
  });
  if (!lido.success || Boolean(lido.data.antesEm) !== Boolean(lido.data.antesId)) {
    return NextResponse.json({ erro: "Atividade inválida." }, { status: 400 });
  }
  const { atividade, antesEm, antesId } = lido.data;
  const primeiraPagina = !antesEm;

  const supabase = await createClient();
  let consulta = supabase
    .from("kanban_comentarios")
    .select(
      "id, texto, autor_id, created_at, editado_em, anexos:kanban_comentario_anexos(id, nome_arquivo, path, created_at, removido)",
      primeiraPagina ? { count: "exact" } : undefined,
    )
    .eq("atividade_id", atividade)
    .eq("removido", false)
    // Filtra só as imagens (sem !inner: comentário sem imagem continua).
    .eq("anexos.removido", false);
  if (antesEm && antesId) {
    consulta = consulta.or(`created_at.lt."${antesEm}",and(created_at.eq."${antesEm}",id.lt.${antesId})`);
  }
  // Uma a mais para saber se há anteriores.
  const { data, error, count } = await consulta
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(COMENTARIOS_POR_PAGINA + 1);

  if (error) {
    console.error("Erro ao listar comentários:", error);
    return NextResponse.json({ erro: "Não foi possível carregar os comentários." }, { status: 500 });
  }

  const temAnteriores = data.length > COMENTARIOS_POR_PAGINA;
  const pagina = data.slice(0, COMENTARIOS_POR_PAGINA).reverse();

  // URLs assinadas de todas as imagens da página numa chamada só.
  const paths = pagina.flatMap((c) => c.anexos.filter((a) => !a.removido).map((a) => a.path));
  const assinadas = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls, error: erroUrls } = await supabase.storage
      .from("atividades")
      .createSignedUrls(paths, VALIDADE_URL_COMENTARIOS);
    if (erroUrls) console.error("Erro ao assinar as imagens dos comentários:", erroUrls);
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl && !u.error) assinadas.set(u.path, u.signedUrl);
    }
  }

  const comentarios: ComentarioAtividade[] = pagina.map(({ anexos, ...c }) => ({
    ...c,
    anexos: anexos
      .filter((a) => !a.removido)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .map((a) => {
        const url = assinadas.get(a.path);
        return url
          ? { id: a.id, nome: a.nome_arquivo, url, miniatura: urlMiniatura(url) }
          : { id: a.id, nome: a.nome_arquivo };
      }),
  }));

  const resposta: PaginaComentarios = {
    comentarios,
    temAnteriores,
    total: primeiraPagina ? (count ?? comentarios.length) : null,
  };
  return NextResponse.json(resposta, { headers: { "Cache-Control": "no-store" } });
}
