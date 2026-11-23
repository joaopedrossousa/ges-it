"use client";

import { cn } from "cn";
import { MessageCircleIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { CampoAnexos, type ItemAnexo } from "@/components/campo-anexos";
import { Carregando } from "@/components/carregando";
import { GaleriaAnexos, type ItemGaleria } from "@/components/galeria-anexos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  iniciaisUsuario,
  nomeUsuario,
  tituloUsuario,
  urlAnexoComentario,
  VALIDADE_URL_COMENTARIOS,
  type ComentarioAtividade,
  type PaginaComentarios,
  type UsuarioSistema,
} from "@/lib/atividades";
import { executarAcao } from "@/lib/executar-acao";
import { formatarDataHora } from "@/lib/format";
import {
  IMAGEM_ACCEPT,
  IMAGENS_MAXIMO,
  enviarImagemComprimida,
  validarImagem,
} from "@/lib/imagens-cliente";

import { adicionarComentario, editarComentario, removerComentario } from "./actions";

type Props = {
  atividadeId: string;
  /** Usuário logado: só o autor edita e remove o próprio comentário. */
  usuarioId: string | null;
  usuarios: UsuarioSistema[];
};

/** Comentários exibidos: do mais antigo ao mais novo (os carregados até agora). */
type Lista = { comentarios: ComentarioAtividade[]; temAnteriores: boolean; total: number };

type Carga =
  | { estado: "carregando" }
  | { estado: "erro"; mensagem: string }
  | ({ estado: "pronto" } & Lista);

/**
 * Cache em memória (só nesta aba) dos comentários de cada cartão: reabrir o
 * mesmo cartão mostra a lista na hora e revalida em segundo plano. Vale a
 * metade da validade das URLs assinadas das imagens, para não exibir uma URL
 * vencida; depois disso, a lista volta a carregar do zero.
 */
const cacheComentarios = new Map<string, { lista: Lista; em: number }>();
const VALIDADE_CACHE_MS = (VALIDADE_URL_COMENTARIOS / 2) * 1000;

function lerCache(atividadeId: string): Lista | null {
  const item = cacheComentarios.get(atividadeId);
  if (!item || Date.now() - item.em > VALIDADE_CACHE_MS) return null;
  return item.lista;
}

function gravarCache(atividadeId: string, lista: Lista) {
  cacheComentarios.set(atividadeId, { lista, em: Date.now() });
}

/**
 * Na revalidação, as imagens que já estavam na tela mantêm a URL e a
 * miniatura anteriores (ainda válidas: o cache dura metade da validade).
 * Uma URL assinada nova mudaria o endereço e baixaria a miniatura de novo.
 */
function manterUrls(novos: ComentarioAtividade[], antigos: ComentarioAtividade[] | null) {
  if (!antigos) return novos;
  const porId = new Map(antigos.flatMap((c) => c.anexos).map((a) => [a.id, a]));
  return novos.map((c) => ({
    ...c,
    anexos: c.anexos.map((a) => {
      const antes = porId.get(a.id);
      return antes?.url ? { ...a, url: antes.url, miniatura: antes.miniatura } : a;
    }),
  }));
}

function cargaInicial(atividadeId: string): Carga {
  const lista = lerCache(atividadeId);
  return lista ? { estado: "pronto", ...lista } : { estado: "carregando" };
}

const mensagemDe = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível carregar os comentários.";

/** Uma página de comentários: sem `antes`, os mais recentes; com ele, os anteriores a ele. */
async function buscarPagina(
  atividadeId: string,
  antes?: ComentarioAtividade,
): Promise<PaginaComentarios> {
  const params = new URLSearchParams({ atividade: atividadeId });
  if (antes) {
    params.set("antesEm", antes.created_at);
    params.set("antesId", antes.id);
  }
  const res = await fetch(`/api/atividades/comentarios?${params}`, {
    headers: { Accept: "application/json" },
    redirect: "manual",
  });
  if (res.type === "opaqueredirect" || res.status === 401) {
    throw new Error("Sua sessão expirou. Recarregue a página e entre novamente.");
  }
  const json: unknown = await res.json();
  if (!res.ok || typeof json !== "object" || json === null || !("comentarios" in json)) {
    throw new Error("Não foi possível carregar os comentários.");
  }
  return json as PaginaComentarios;
}

/**
 * Imagem do comentário na galeria: miniatura reduzida (otimizador do Next) e
 * a URL assinada do lote para ampliar. Se faltarem ou expirarem, a reserva
 * (/api/atividades/anexo) gera uma URL nova.
 */
function itemGaleria(a: ComentarioAtividade["anexos"][number]): ItemGaleria {
  const reserva = urlAnexoComentario(a.id);
  return {
    chave: a.id,
    nome: a.nome,
    tipo: "imagem",
    url: a.url ?? reserva,
    miniatura: a.miniatura,
    reserva,
  };
}

/** Acima disto o texto vem recolhido, com "Ver mais". */
const LIMITE_CARACTERES = 600;
const LIMITE_LINHAS = 8;

/** Texto do comentário; longo (caracteres ou linhas) aparece recolhido em 6 linhas. */
function TextoComentario({ texto }: { texto: string }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const longo = texto.length > LIMITE_CARACTERES || texto.split("\n").length > LIMITE_LINHAS;
  return (
    <div className="grid justify-items-start gap-1">
      <p
        id={id}
        className={cn(
          "w-full text-sm break-words whitespace-pre-wrap",
          longo && !aberto && "line-clamp-6",
        )}
      >
        {texto}
      </p>
      {longo && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          aria-expanded={aberto}
          aria-controls={id}
          onClick={() => setAberto((v) => !v)}
        >
          {aberto ? "Ver menos" : "Ver mais"}
        </Button>
      )}
    </div>
  );
}

/**
 * Envia as imagens que ainda não subiram (reduzidas no navegador) para
 * atividades/{atividade_id}/... e devolve {path, nome}, ou a mensagem de erro.
 * `enviadas` (chave → caminho) evita reenviar numa nova tentativa.
 */
async function enviarImagens(
  atividadeId: string,
  itens: ItemAnexo[],
  enviadas: Map<string, string>,
  onProgresso: (texto: string) => void,
): Promise<{ path: string; nome: string }[] | { erro: string }> {
  const lista: { path: string; nome: string }[] = [];
  for (const [i, item] of itens.entries()) {
    let path = enviadas.get(item.chave);
    if (!path) {
      onProgresso(`Enviando imagens (${i + 1} de ${itens.length})...`);
      const envio = await enviarImagemComprimida("atividades", atividadeId, item.arquivo);
      if ("erro" in envio) return envio;
      path = envio.path;
      enviadas.set(item.chave, path);
    }
    lista.push({ path, nome: item.arquivo.name });
  }
  return lista;
}

/**
 * Comentários da atividade (migration 022), do mais antigo para o mais novo,
 * com imagens (colar print, arrastar ou escolher). Editar e remover só pelo
 * autor; remover só marca (fica no log de auditoria).
 */
export function ComentariosAtividade({ atividadeId, usuarioId, usuarios }: Props) {
  // Do cache, se houver: o cartão reaberto mostra os comentários na hora.
  const [carga, setCarga] = useState<Carga>(() => cargaInicial(atividadeId));
  const [atividadeVista, setAtividadeVista] = useState(atividadeId);
  const [versao, setVersao] = useState(0);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false);
  const [erroAnteriores, setErroAnteriores] = useState<string | null>(null);
  const usuariosPorId = new Map(usuarios.map((u) => [u.id, u]));

  // Outro cartão no mesmo painel: troca a lista durante a renderização, sem
  // efeito (https://react.dev/learn/you-might-not-need-an-effect).
  if (atividadeId !== atividadeVista) {
    setAtividadeVista(atividadeId);
    setCarga(cargaInicial(atividadeId));
    setErroAnteriores(null);
  }

  // Sempre busca os mais recentes: carrega ou revalida o cache em segundo plano.
  useEffect(() => {
    let ativo = true;
    buscarPagina(atividadeId)
      .then((p) => {
        const lista: Lista = {
          comentarios: manterUrls(p.comentarios, lerCache(atividadeId)?.comentarios ?? null),
          temAnteriores: p.temAnteriores,
          total: p.total ?? p.comentarios.length,
        };
        gravarCache(atividadeId, lista);
        if (ativo) setCarga({ estado: "pronto", ...lista });
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        // Com a lista do cache na tela, mantém a lista (a revalidação falhou em silêncio).
        setCarga((atual) =>
          atual.estado === "pronto" ? atual : { estado: "erro", mensagem: mensagemDe(e) },
        );
      });
    return () => {
      ativo = false;
    };
  }, [atividadeId, versao]);

  const recarregar = () => setVersao((v) => v + 1);

  /** "Carregar anteriores": a página antes do comentário mais antigo exibido. */
  async function carregarAnteriores() {
    if (carga.estado !== "pronto" || carga.comentarios.length === 0) return;
    const doCartao = atividadeId;
    const cursor = carga.comentarios[0];
    setCarregandoAnteriores(true);
    setErroAnteriores(null);
    try {
      const p = await buscarPagina(doCartao, cursor);
      setCarga((atual) => {
        // Só junta se a lista ainda começa no cursor (outro cartão ou recarga no meio: descarta).
        if (atual.estado !== "pronto" || atual.comentarios[0]?.id !== cursor.id) return atual;
        const vistos = new Set(atual.comentarios.map((c) => c.id));
        const lista: Lista = {
          comentarios: [...p.comentarios.filter((c) => !vistos.has(c.id)), ...atual.comentarios],
          temAnteriores: p.temAnteriores,
          total: atual.total,
        };
        gravarCache(doCartao, lista);
        return { estado: "pronto", ...lista };
      });
    } catch (e: unknown) {
      setErroAnteriores(mensagemDe(e));
    } finally {
      setCarregandoAnteriores(false);
    }
  }

  return (
    <section aria-labelledby="comentarios-titulo" className="grid gap-3 border-t pt-4">
      <h3 id="comentarios-titulo" className="flex items-center gap-2 text-sm font-medium">
        <MessageCircleIcon className="size-4 text-muted-foreground" aria-hidden />
        Comentários
        {carga.estado === "pronto" && (
          <span className="font-normal text-muted-foreground">({carga.total})</span>
        )}
      </h3>

      {carga.estado === "carregando" && <Carregando rotulo="Carregando comentários..." tamanho="sm" />}
      {carga.estado === "erro" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          {carga.mensagem}
          <Button type="button" variant="outline" size="sm" onClick={recarregar}>
            Tentar de novo
          </Button>
        </div>
      )}
      {carga.estado === "pronto" &&
        (carga.comentarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
        ) : (
          <>
            {carga.temAnteriores && (
              <div className="grid justify-items-start gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={carregarAnteriores}
                  disabled={carregandoAnteriores}
                >
                  {carregandoAnteriores && <Carregando decorativo tamanho="sm" />}
                  {carregandoAnteriores
                    ? "Carregando..."
                    : `Carregar anteriores (${Math.max(0, carga.total - carga.comentarios.length)})`}
                </Button>
                {erroAnteriores && (
                  <p role="alert" className="text-sm text-destructive">
                    {erroAnteriores}
                  </p>
                )}
              </div>
            )}
            <ol className="grid gap-3">
              {carga.comentarios.map((c) => (
                <ItemComentario
                  key={c.id}
                  comentario={c}
                  atividadeId={atividadeId}
                  autor={c.autor_id ? usuariosPorId.get(c.autor_id) : undefined}
                  meu={Boolean(usuarioId) && c.autor_id === usuarioId}
                  editando={editandoId === c.id}
                  onEditar={(v) => setEditandoId(v ? c.id : null)}
                  onAlterado={recarregar}
                />
              ))}
            </ol>
          </>
        ))}

      <NovoComentario
        atividadeId={atividadeId}
        // Só um campo recebe o print colado: o da edição, quando houver.
        colar={editandoId === null}
        onEnviado={recarregar}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------

function NovoComentario({
  atividadeId,
  colar,
  onEnviado,
}: {
  atividadeId: string;
  colar: boolean;
  onEnviado: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [itens, setItens] = useState<ItemAnexo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const enviadas = useRef(new Map<string, string>());

  function comentar() {
    if (!texto.trim() && itens.length === 0) {
      setErro("Escreva um comentário ou anexe uma imagem.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const anexos = await enviarImagens(atividadeId, itens, enviadas.current, setEtapa);
      if ("erro" in anexos) {
        setEtapa(null);
        setErro(anexos.erro);
        return;
      }
      setEtapa("Salvando...");
      const r = await executarAcao(() =>
        adicionarComentario({ atividade_id: atividadeId, texto, anexos }),
      );
      setEtapa(null);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setTexto("");
      setItens([]);
      enviadas.current = new Map();
      onEnviado();
    });
  }

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
      <Label htmlFor="novo-comentario">Novo comentário</Label>
      <Textarea
        id="novo-comentario"
        rows={3}
        maxLength={5000}
        placeholder="Escreva um comentário..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl+Enter envia.
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            comentar();
          }
        }}
        disabled={isPending}
        aria-describedby={erro ? "novo-comentario-erro" : "novo-comentario-ajuda"}
      />
      <CampoAnexos
        id="novo-comentario-imagens"
        itens={itens}
        onChange={setItens}
        accept={IMAGEM_ACCEPT}
        validar={validarImagem}
        maximo={IMAGENS_MAXIMO}
        colar={colar}
        disabled={isPending}
      />
      <p id="novo-comentario-ajuda" className="text-xs text-muted-foreground">
        Imagens JPG, PNG ou WebP, até 10 MB cada. Ctrl+Enter envia.
      </p>
      {erro && (
        <p id="novo-comentario-erro" role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="button" onClick={comentar} disabled={isPending}>
          {isPending && <Carregando decorativo tamanho="sm" />}
          {isPending ? (etapa ?? "Enviando...") : "Comentar"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ItemComentario({
  comentario: c,
  atividadeId,
  autor,
  meu,
  editando,
  onEditar,
  onAlterado,
}: {
  comentario: ComentarioAtividade;
  atividadeId: string;
  autor: UsuarioSistema | undefined;
  meu: boolean;
  editando: boolean;
  onEditar: (editando: boolean) => void;
  onAlterado: () => void;
}) {
  const [texto, setTexto] = useState(c.texto ?? "");
  const [removidas, setRemovidas] = useState<string[]>([]);
  const [novas, setNovas] = useState<ItemAnexo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [isPending, startTransition] = useTransition();
  const enviadas = useRef(new Map<string, string>());
  const nomeAutor = c.autor_id ? nomeUsuario(autor) : "Autor não identificado";

  function abrirEdicao() {
    setTexto(c.texto ?? "");
    setRemovidas([]);
    setNovas([]);
    setErro(null);
    enviadas.current = new Map();
    onEditar(true);
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const anexos = await enviarImagens(atividadeId, novas, enviadas.current, setEtapa);
      if ("erro" in anexos) {
        setEtapa(null);
        setErro(anexos.erro);
        return;
      }
      setEtapa("Salvando...");
      const r = await executarAcao(() =>
        editarComentario({
          comentario_id: c.id,
          texto,
          anexos_novos: anexos,
          anexos_removidos: removidas,
        }),
      );
      setEtapa(null);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      toast.success("Comentário editado.");
      onEditar(false);
      onAlterado();
    });
  }

  function remover() {
    startTransition(async () => {
      const r = await executarAcao(() => removerComentario(c.id));
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setConfirmarRemocao(false);
      toast.success("Comentário removido.");
      onAlterado();
    });
  }

  const anexosVisiveis = c.anexos.filter((a) => !removidas.includes(a.id));

  return (
    <li className="grid gap-2 rounded-lg border bg-cartao-kanban p-3">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
        >
          {c.autor_id ? iniciaisUsuario(autor) : "?"}
        </span>
        <div className="min-w-0 flex-1 text-sm leading-tight">
          <p className="truncate font-medium" title={tituloUsuario(autor)}>
            {nomeAutor}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatarDataHora(c.created_at)}
            {c.editado_em && (
              <span title={`Editado em ${formatarDataHora(c.editado_em)}`}> · editado</span>
            )}
          </p>
        </div>
        {meu && !editando && (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={abrirEdicao}
              aria-label="Editar comentário"
            >
              <PencilIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirmarRemocao(true)}
              aria-label="Remover comentário"
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
      </div>

      {editando ? (
        <div className="grid gap-2">
          <Label htmlFor={`comentario-${c.id}`} className="sr-only">
            Texto do comentário
          </Label>
          <Textarea
            id={`comentario-${c.id}`}
            rows={3}
            maxLength={5000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={isPending}
            autoFocus
          />
          <GaleriaAnexos
            rotulo="Imagens do comentário"
            itens={anexosVisiveis.map(itemGaleria)}
            onRemover={(id) => setRemovidas((r) => [...r, id])}
            disabled={isPending}
          />
          <CampoAnexos
            id={`comentario-${c.id}-imagens`}
            itens={novas}
            onChange={setNovas}
            accept={IMAGEM_ACCEPT}
            validar={validarImagem}
            maximo={Math.max(0, IMAGENS_MAXIMO - anexosVisiveis.length)}
            disabled={isPending}
          />
          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditar(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={salvar} disabled={isPending}>
              {isPending && <Carregando decorativo tamanho="sm" />}
              {isPending ? (etapa ?? "Salvando...") : "Salvar"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {c.texto && <TextoComentario texto={c.texto} />}
          <GaleriaAnexos rotulo="Imagens do comentário" itens={c.anexos.map(itemGaleria)} />
        </>
      )}

      <Dialog open={confirmarRemocao} onOpenChange={(v) => !isPending && setConfirmarRemocao(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover Comentário?</DialogTitle>
            <DialogDescription>
              O comentário e as imagens dele saem da atividade. A remoção fica registrada no log
              de auditoria.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmarRemocao(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={remover} disabled={isPending}>
              {isPending && <Carregando decorativo tamanho="sm" />}
              {isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
