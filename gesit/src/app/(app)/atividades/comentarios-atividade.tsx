"use client";

import { MessageCircleIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { CampoAnexos, type ItemAnexo } from "@/components/campo-anexos";
import { Carregando } from "@/components/carregando";
import { GaleriaAnexos } from "@/components/galeria-anexos";
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
  type ComentarioAtividade,
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

type Carga =
  | { estado: "carregando" }
  | { estado: "erro"; mensagem: string }
  | { estado: "pronto"; comentarios: ComentarioAtividade[] };

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
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [versao, setVersao] = useState(0);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const usuariosPorId = new Map(usuarios.map((u) => [u.id, u]));

  useEffect(() => {
    let ativo = true;
    fetch(`/api/atividades/comentarios?atividade=${atividadeId}`, {
      headers: { Accept: "application/json" },
      redirect: "manual",
    })
      .then(async (res) => {
        if (res.type === "opaqueredirect" || res.status === 401) {
          throw new Error("Sua sessão expirou. Recarregue a página e entre novamente.");
        }
        const json: unknown = await res.json();
        if (!res.ok || typeof json !== "object" || json === null || !("comentarios" in json)) {
          throw new Error("Não foi possível carregar os comentários.");
        }
        return json.comentarios as ComentarioAtividade[];
      })
      .then((comentarios) => ativo && setCarga({ estado: "pronto", comentarios }))
      .catch((e: unknown) =>
        ativo &&
        setCarga({
          estado: "erro",
          mensagem: e instanceof Error ? e.message : "Não foi possível carregar os comentários.",
        }),
      );
    return () => {
      ativo = false;
    };
  }, [atividadeId, versao]);

  const recarregar = () => setVersao((v) => v + 1);

  return (
    <section aria-labelledby="comentarios-titulo" className="grid gap-3 border-t pt-4">
      <h3 id="comentarios-titulo" className="flex items-center gap-2 text-sm font-medium">
        <MessageCircleIcon className="size-4 text-muted-foreground" aria-hidden />
        Comentários
        {carga.estado === "pronto" && (
          <span className="font-normal text-muted-foreground">({carga.comentarios.length})</span>
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
            itens={anexosVisiveis.map((a) => ({
              chave: a.id,
              nome: a.nome,
              tipo: "imagem",
              url: urlAnexoComentario(a.id),
            }))}
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
          {c.texto && <p className="text-sm break-words whitespace-pre-wrap">{c.texto}</p>}
          <GaleriaAnexos
            rotulo="Imagens do comentário"
            itens={c.anexos.map((a) => ({
              chave: a.id,
              nome: a.nome,
              tipo: "imagem",
              url: urlAnexoComentario(a.id),
            }))}
          />
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
