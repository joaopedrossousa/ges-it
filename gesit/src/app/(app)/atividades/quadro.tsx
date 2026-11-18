"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import {
  AlarmClockIcon,
  ArchiveIcon,
  CircleCheckBigIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  GripVerticalIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PanelRightOpenIcon,
  PencilIcon,
  PlusIcon,
  SirenIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { toast } from "sonner";

import { Etiqueta, SeloPrioridade } from "@/components/atividades/etiquetas";
import { Carregando } from "@/components/carregando";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CLASSES_COR,
  FILTROS_VAZIOS,
  iniciaisUsuario,
  nomeCurtoUsuario,
  passaNosFiltros,
  situacaoPrazo,
  temFiltro,
  tituloUsuario,
  type AtividadeQuadro,
  type CategoriaKanban,
  type ColunaQuadro,
  type FiltrosQuadro,
  type UsuarioSistema,
} from "@/lib/atividades";
import type { ActionResult } from "@/lib/action-result";
import { executarAcao } from "@/lib/executar-acao";
import { formatarDataISO } from "@/lib/format";

import { arquivarColuna, marcarUrgente, moverAtividade, moverColuna } from "./actions";
import { concluirAtividade } from "./concluir-atividade";
import { ColunaFormDialog } from "./coluna-form-dialog";
import { BarraFiltros } from "./filtros-quadro";
import { PainelAtividade, type EstadoPainel } from "./painel-atividade";

type Props = {
  /** Colunas ativas, na ordem. */
  colunas: ColunaQuadro[];
  /** Atividades ativas, na ordem de cada coluna. */
  atividades: AtividadeQuadro[];
  categorias: CategoriaKanban[];
  usuarios: UsuarioSistema[];
  /** "AAAA-MM-DD" em Palmas, calculado no servidor. */
  hoje: string;
  /** Usuário logado (autor dos comentários). */
  usuarioId: string | null;
};

/** Ids do dnd-kit: "c:<id>" para colunas e "a:<id>" para atividades. */
type Item = { tipo: "coluna" | "atividade"; id: string };
const ler = (id: UniqueIdentifier): Item => {
  const s = String(id);
  return { tipo: s.startsWith("c:") ? "coluna" : "atividade", id: s.slice(2) };
};
const idColuna = (id: string) => `c:${id}`;
const idAtividade = (id: string) => `a:${id}`;

type Itens = Record<string, string[]>;
type Retrato = { ordem: string[]; itens: Itens };

function agrupar(colunas: ColunaQuadro[], atividades: AtividadeQuadro[]): Itens {
  const itens: Itens = Object.fromEntries(colunas.map((c) => [c.id, [] as string[]]));
  for (const a of atividades) itens[a.coluna_id]?.push(a.id);
  return itens;
}

/**
 * Altura do quadro = do topo dele até o fim da janela (menos o padding
 * inferior do <main>), em --altura-quadro. Assim a barra de rolagem
 * horizontal fica sempre na base da tela e cada coluna rola sozinha. Mede de
 * novo ao redimensionar e quando o conteúdo acima muda de altura (filtros
 * quebrando linha). Sem estado do React: só a variável CSS do elemento.
 */
function useAlturaAteOFim(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const main = el.closest("main");
    function medir() {
      if (!el) return;
      const topo = el.getBoundingClientRect().top + window.scrollY;
      // O que fica abaixo do quadro até o fim do <main>: margens inferiores
      // (no Tailwind 4 o space-y-* põe margem embaixo de cada filho menos o
      // último, e o dnd-kit insere nós de acessibilidade depois do quadro) e
      // paddings inferiores dos ancestrais, inclusive o do <main>.
      let abaixo = 0;
      for (let n: HTMLElement | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        abaixo += (parseFloat(cs.marginBottom) || 0) + (n === el ? 0 : parseFloat(cs.paddingBottom) || 0);
        if (n === main) break;
      }
      el.style.setProperty("--altura-quadro", `${Math.floor(window.innerHeight - topo - abaixo)}px`);
    }
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(document.body);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [ref]);
}

function colunaDe(id: string, itens: Itens): string | undefined {
  return Object.keys(itens).find((c) => itens[c].includes(id));
}

const FILTROS_URL = ["q", "categoria", "prioridade", "responsavel", "urgente"] as const;

/** Grava ?chave=valor sem recarregar (os filtros rodam no navegador). */
function gravarNaUrl(mudancas: Record<string, string>) {
  const params = new URLSearchParams(window.location.search);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor) params.set(chave, valor);
    else params.delete(chave);
  }
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export function Quadro({ colunas, atividades, categorias, usuarios, hoje, usuarioId }: Props) {
  const searchParams = useSearchParams();

  // Estado local (otimista) da ordem; volta a seguir o servidor quando não há
  // arrasto nem gravação pendente.
  const [ordem, setOrdem] = useState(() => colunas.map((c) => c.id));
  const [itens, setItens] = useState(() => agrupar(colunas, atividades));
  const [pendentes, setPendentes] = useState(0);
  const [ativo, setAtivo] = useState<Item | null>(null);
  const [antes, setAntes] = useState<Retrato | null>(null);
  const [base, setBase] = useState({ colunas, atividades });
  if (ativo === null && pendentes === 0 && (base.colunas !== colunas || base.atividades !== atividades)) {
    // Ajuste durante a renderização: https://react.dev/learn/you-might-not-need-an-effect
    setBase({ colunas, atividades });
    setOrdem(colunas.map((c) => c.id));
    setItens(agrupar(colunas, atividades));
  }

  const [filtros, setFiltros] = useState<FiltrosQuadro>(() => ({
    q: searchParams.get("q") ?? "",
    categoria: searchParams.get("categoria") ?? "",
    prioridade: searchParams.get("prioridade") ?? "",
    responsavel: searchParams.get("responsavel") ?? "",
    urgente: searchParams.get("urgente") === "1" ? "1" : "",
  }));

  const [painel, setPainel] = useState<EstadoPainel>(() => {
    const id = searchParams.get("atividade");
    return id && atividades.some((a) => a.id === id) ? { modo: "editar", id } : null;
  });
  const [editandoColuna, setEditandoColuna] = useState<ColunaQuadro | null>(null);
  const quadroRef = useRef<HTMLDivElement>(null);
  useAlturaAteOFim(quadroRef);
  const [arquivandoColuna, setArquivandoColuna] = useState<ColunaQuadro | null>(null);

  const colunasPorId = useMemo(() => new Map(colunas.map((c) => [c.id, c])), [colunas]);
  const atividadesPorId = useMemo(() => new Map(atividades.map((a) => [a.id, a])), [atividades]);
  const categoriasPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const usuariosPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);

  const colunasEmOrdem = ordem
    .map((id) => colunasPorId.get(id))
    .filter((c): c is ColunaQuadro => Boolean(c));

  const filtrando = temFiltro(filtros);
  const visiveis = useMemo(() => {
    const v: Itens = {};
    for (const [coluna, ids] of Object.entries(itens)) {
      v[coluna] = ids.filter((id) => {
        const a = atividadesPorId.get(id);
        return a !== undefined && passaNosFiltros(a, filtros);
      });
    }
    return v;
  }, [itens, atividadesPorId, filtros]);
  const totalVisiveis = Object.values(visiveis).reduce((s, ids) => s + ids.length, 0);

  // ------------------------------------------------------------------
  // Filtros e painel
  // ------------------------------------------------------------------

  function mudarFiltro(chave: keyof FiltrosQuadro, valor: string) {
    setFiltros((f) => ({ ...f, [chave]: valor }));
    gravarNaUrl({ [chave]: valor });
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    gravarNaUrl(Object.fromEntries(FILTROS_URL.map((c) => [c, ""])));
  }

  function fecharPainel() {
    setPainel(null);
    if (searchParams.get("atividade")) gravarNaUrl({ atividade: "" });
  }

  // ------------------------------------------------------------------
  // Gravação com reversão
  // ------------------------------------------------------------------

  async function enviar(acao: () => Promise<ActionResult>, retrato: Retrato | null, erro: string) {
    setPendentes((n) => n + 1);
    const r = await executarAcao(acao);
    setPendentes((n) => n - 1);
    if (!r.ok) {
      if (retrato) {
        setOrdem(retrato.ordem);
        setItens(retrato.itens);
      }
      toast.error(erro, { description: r.error });
    }
  }

  function moverColunaPara(colunaId: string, para: number) {
    const de = ordem.indexOf(colunaId);
    if (de < 0 || para < 0 || para >= ordem.length || de === para) return;
    const retrato = { ordem, itens };
    setOrdem(arrayMove(ordem, de, para));
    void enviar(() => moverColuna(colunaId, para), retrato, "Não foi possível mover a coluna.");
  }

  // ------------------------------------------------------------------
  // Arrastar e soltar
  // ------------------------------------------------------------------

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // No toque, segurar um instante para arrastar: deslizar continua rolando a tela.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Espaço pega e solta; Enter fica para abrir a atividade.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  /**
   * Colunas: só disputam com colunas. Atividades: o cartão sob o ponteiro;
   * fora de um cartão, o mais próximo da coluna (ou a própria coluna vazia).
   */
  const deteccao: CollisionDetection = (args) => {
    if (ler(args.active.id).tipo === "coluna") {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => ler(c.id).tipo === "coluna"),
      });
    }
    const sob = pointerWithin(args);
    const colisoes = sob.length > 0 ? sob : rectIntersection(args);
    const cartao = colisoes.find((c) => ler(c.id).tipo === "atividade");
    if (cartao) return [cartao];
    const coluna = colisoes.find((c) => ler(c.id).tipo === "coluna");
    if (!coluna) return [];
    const ids = new Set((visiveis[ler(coluna.id).id] ?? []).map(idAtividade));
    if (ids.size > 0) {
      const perto = closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => ids.has(String(c.id))),
      });
      if (perto.length > 0) return [perto[0]];
    }
    return [coluna];
  };

  function onDragStart({ active }: DragStartEvent) {
    setAtivo(ler(active.id));
    setAntes({ ordem, itens });
  }

  /** Atividade passando para outra coluna: entra antes ou depois do cartão sob ela. */
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const a = ler(active.id);
    if (a.tipo !== "atividade") return;
    const o = ler(over.id);
    setItens((prev) => {
      const de = colunaDe(a.id, prev);
      const para = o.tipo === "coluna" ? o.id : colunaDe(o.id, prev);
      if (!de || !para || de === para) return prev;
      const destino = prev[para].filter((x) => x !== a.id);
      let indice = destino.length;
      if (o.tipo === "atividade") {
        const i = destino.indexOf(o.id);
        const r = active.rect.current.translated;
        const abaixo = r ? r.top + r.height / 2 > over.rect.top + over.rect.height / 2 : false;
        if (i >= 0) indice = i + (abaixo ? 1 : 0);
      }
      destino.splice(indice, 0, a.id);
      return { ...prev, [de]: prev[de].filter((x) => x !== a.id), [para]: destino };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const a = ler(active.id);
    const retrato = antes;
    setAtivo(null);
    setAntes(null);

    if (!over) {
      onDragCancel();
      return;
    }
    const o = ler(over.id);

    if (a.tipo === "coluna") {
      const alvo = o.tipo === "coluna" ? o.id : colunaDe(o.id, itens);
      const de = ordem.indexOf(a.id);
      const para = alvo ? ordem.indexOf(alvo) : -1;
      if (para < 0 || de === para) return;
      setOrdem(arrayMove(ordem, de, para));
      void enviar(() => moverColuna(a.id, para), retrato, "Não foi possível mover a coluna.");
      return;
    }

    const coluna = colunaDe(a.id, itens);
    if (!coluna) return;
    let lista = itens[coluna];
    if (o.tipo === "atividade" && o.id !== a.id && lista.includes(o.id)) {
      lista = arrayMove(lista, lista.indexOf(a.id), lista.indexOf(o.id));
      setItens({ ...itens, [coluna]: lista });
    }
    // Posição na lista completa da coluna (com filtro, os ocultos contam).
    const posicao = lista.indexOf(a.id);
    const colunaAntes = retrato ? colunaDe(a.id, retrato.itens) : undefined;
    const posicaoAntes = retrato && colunaAntes ? retrato.itens[colunaAntes].indexOf(a.id) : -1;
    if (coluna === colunaAntes && posicao === posicaoAntes) return;
    void enviar(
      () => moverAtividade(a.id, coluna, posicao),
      retrato,
      "Não foi possível mover a atividade.",
    );
  }

  function onDragCancel() {
    if (antes) {
      setOrdem(antes.ordem);
      setItens(antes.itens);
    }
    setAtivo(null);
    setAntes(null);
  }

  // Leitor de tela: avisos em português.
  const nomeItem = (id: UniqueIdentifier) => {
    const i = ler(id);
    return i.tipo === "coluna"
      ? `Coluna ${colunasPorId.get(i.id)?.nome ?? ""}`
      : `Atividade ${atividadesPorId.get(i.id)?.titulo ?? ""}`;
  };
  const destino = (id: UniqueIdentifier) => {
    const i = ler(id);
    if (i.tipo === "coluna") {
      return `posição ${ordem.indexOf(i.id) + 1} de ${ordem.length} (coluna ${colunasPorId.get(i.id)?.nome ?? ""})`;
    }
    const coluna = colunaDe(i.id, itens);
    if (!coluna) return "";
    return `posição ${itens[coluna].indexOf(i.id) + 1} de ${itens[coluna].length} na coluna ${
      colunasPorId.get(coluna)?.nome ?? ""
    }`;
  };
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `${nomeItem(active.id)} selecionada. Use as setas para mover.`,
    onDragOver: ({ active, over }) =>
      over ? `${nomeItem(active.id)} em ${destino(over.id)}.` : `${nomeItem(active.id)} fora do quadro.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nomeItem(active.id)} solta em ${destino(over.id)}.` : `${nomeItem(active.id)} solta.`,
    onDragCancel: ({ active }) => `Movimento cancelado. ${nomeItem(active.id)} voltou ao lugar.`,
  };

  const atividadeArrastada = ativo?.tipo === "atividade" ? atividadesPorId.get(ativo.id) : undefined;
  const colunaArrastada = ativo?.tipo === "coluna" ? colunasPorId.get(ativo.id) : undefined;

  return (
    <div className="space-y-4">
      <BarraFiltros
        filtros={filtros}
        onChange={mudarFiltro}
        onLimpar={limparFiltros}
        categorias={categorias}
        usuarios={usuarios}
      />

      <div role="status" className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground">
        {pendentes > 0 && <Carregando rotulo="Salvando a nova ordem..." tamanho="sm" />}
        {filtrando &&
          (totalVisiveis === 0
            ? "Nenhuma atividade encontrada com esses filtros."
            : `${totalVisiveis} ${totalVisiveis === 1 ? "atividade encontrada" : "atividades encontradas"}.`)}
      </div>

      {colunasEmOrdem.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Nenhuma coluna no quadro. Crie a primeira com o botão &quot;Nova coluna&quot;.
        </div>
      ) : (
        <DndContext
          id="quadro-atividades"
          sensors={sensores}
          collisionDetection={deteccao}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          accessibility={{
            announcements: anuncios,
            screenReaderInstructions: {
              draggable:
                "Para mover, pressione Espaço, use as setas e pressione Espaço de novo para soltar. Esc cancela. Enter abre a atividade.",
            },
          }}
        >
          <SortableContext items={ordem.map(idColuna)} strategy={horizontalListSortingStrategy}>
            {/*
              Altura de tela (--altura-quadro, medida; calc de reserva) com
              mínimo: a barra horizontal fica na base da janela e as colunas
              rolam por dentro. No celular os filtros ocupam muito: o mínimo é
              quase a tela toda (rola-se a página até o quadro, que então
              ocupa a tela). O dnd-kit rola sozinho o quadro e as colunas
              ao arrastar perto das bordas.
            */}
            <div
              ref={quadroRef}
              className="-mx-4 h-[var(--altura-quadro,calc(100dvh-16rem))] min-h-[calc(100dvh-6rem)] overflow-x-auto overflow-y-hidden px-4 pb-2 md:-mx-6 md:min-h-96 md:px-6"
            >
              <div className="flex h-full w-max items-start gap-4">
                {colunasEmOrdem.map((c, i) => (
                  <ColunaKanban
                    key={c.id}
                    coluna={c}
                    ids={visiveis[c.id] ?? []}
                    total={itens[c.id]?.length ?? 0}
                    filtrando={filtrando}
                    primeira={i === 0}
                    ultima={i === colunasEmOrdem.length - 1}
                    atividadesPorId={atividadesPorId}
                    categoriasPorId={categoriasPorId}
                    usuariosPorId={usuariosPorId}
                    hoje={hoje}
                    onAbrir={(id) => setPainel({ modo: "editar", id })}
                    onNova={() => setPainel({ modo: "nova", colunaId: c.id })}
                    onEditar={() => setEditandoColuna(c)}
                    onArquivar={() => setArquivandoColuna(c)}
                    onMover={(passo) => moverColunaPara(c.id, i + passo)}
                  />
                ))}
              </div>
            </div>
          </SortableContext>

          <DragOverlay>
            {atividadeArrastada && (
              <CartaoConteudo
                atividade={atividadeArrastada}
                categoriasPorId={categoriasPorId}
                usuariosPorId={usuariosPorId}
                hoje={hoje}
                className="rotate-2 cursor-grabbing shadow-lg"
              />
            )}
            {colunaArrastada && (
              <div
                className={cn(
                  "flex w-72 cursor-grabbing items-center gap-2 rounded-xl border p-3 shadow-lg",
                  CLASSES_COR[colunaArrastada.cor].coluna,
                )}
              >
                <span
                  className={cn(
                    "truncate rounded-md px-1.5 py-0.5 text-sm font-semibold",
                    CLASSES_COR[colunaArrastada.cor].etiqueta,
                  )}
                >
                  {colunaArrastada.nome}
                </span>
                <span className="text-sm text-muted-foreground">
                  {itens[colunaArrastada.id]?.length ?? 0}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <PainelAtividade
        estado={painel}
        atividade={painel?.modo === "editar" ? (atividadesPorId.get(painel.id) ?? null) : null}
        colunas={colunasEmOrdem}
        categorias={categorias}
        usuarios={usuarios}
        usuarioId={usuarioId}
        onFechar={fecharPainel}
      />

      <ColunaFormDialog
        coluna={editandoColuna ?? undefined}
        open={editandoColuna !== null}
        onOpenChange={(v) => !v && setEditandoColuna(null)}
      />

      <ArquivarColunaDialog
        coluna={arquivandoColuna}
        atividadesAtivas={arquivandoColuna ? (itens[arquivandoColuna.id]?.length ?? 0) : 0}
        onFechar={() => setArquivandoColuna(null)}
      />
    </div>
  );
}

// ===========================================================================
// Coluna
// ===========================================================================

function ColunaKanban({
  coluna,
  ids,
  total,
  filtrando,
  primeira,
  ultima,
  atividadesPorId,
  categoriasPorId,
  usuariosPorId,
  hoje,
  onAbrir,
  onNova,
  onEditar,
  onArquivar,
  onMover,
}: {
  coluna: ColunaQuadro;
  /** Atividades visíveis (filtradas), na ordem. */
  ids: string[];
  total: number;
  filtrando: boolean;
  primeira: boolean;
  ultima: boolean;
  atividadesPorId: Map<string, AtividadeQuadro>;
  categoriasPorId: Map<string, CategoriaKanban>;
  usuariosPorId: Map<string, UsuarioSistema>;
  hoje: string;
  onAbrir: (id: string) => void;
  onNova: () => void;
  onEditar: () => void;
  onArquivar: () => void;
  onMover: (passo: -1 | 1) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: idColuna(coluna.id), attributes: { roleDescription: "coluna arrastável" } });
  const tituloId = `coluna-${coluna.id}`;
  const contagem = filtrando ? `${ids.length} de ${total}` : String(total);

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={tituloId}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        // A cor pinta a coluna inteira, em tom pastel; os cartões ficam neutros.
        // max-h-full: a coluna não passa da altura do quadro; a lista rola por dentro.
        "flex max-h-full w-72 shrink-0 flex-col rounded-xl border",
        CLASSES_COR[coluna.cor].coluna,
        isDragging && "opacity-40",
      )}
    >
      <header className="flex shrink-0 items-center gap-1.5 p-2 pb-1">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Mover a coluna ${coluna.nome}`}
          className="flex size-7 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-cartao-kanban hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripVerticalIcon aria-hidden className="size-4" />
        </button>
        <h2 id={tituloId} className="flex min-w-0 flex-1" title={coluna.nome}>
          <span
            className={cn(
              "truncate rounded-md px-1.5 py-0.5 text-sm font-semibold",
              CLASSES_COR[coluna.cor].etiqueta,
            )}
          >
            {coluna.nome}
          </span>
        </h2>
        <span
          className="rounded-md bg-cartao-kanban px-1.5 text-xs font-medium text-muted-foreground tabular-nums"
          aria-label={
            filtrando
              ? `${ids.length} de ${total} atividades`
              : `${total} ${total === 1 ? "atividade" : "atividades"}`
          }
        >
          {contagem}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações da coluna ${coluna.nome}`}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEditar}>
              <PencilIcon />
              Renomear ou trocar a cor
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMover(-1)} disabled={primeira}>
              <ArrowLeftIcon />
              Mover para a esquerda
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMover(1)} disabled={ultima}>
              <ArrowRightIcon />
              Mover para a direita
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArquivar} variant="destructive">
              <ArchiveIcon />
              Arquivar coluna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <SortableContext items={ids.map(idAtividade)} strategy={verticalListSortingStrategy}>
        <ol
          className="flex min-h-14 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 py-1"
          aria-labelledby={tituloId}
        >
          {ids.map((id) => {
            const a = atividadesPorId.get(id);
            return a ? (
              <CartaoAtividade
                key={id}
                atividade={a}
                categoriasPorId={categoriasPorId}
                usuariosPorId={usuariosPorId}
                hoje={hoje}
                onAbrir={() => onAbrir(id)}
              />
            ) : null;
          })}
          {ids.length === 0 && (
            <li className="flex min-h-14 items-center justify-center rounded-lg border border-dashed border-foreground/15 px-3 text-center text-xs text-muted-foreground">
              {filtrando && total > 0
                ? "Nenhuma atividade com esses filtros."
                : "Nenhuma atividade. Arraste uma para cá ou crie uma nova."}
            </li>
          )}
        </ol>
      </SortableContext>

      <div className="shrink-0 p-2 pt-1">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={onNova}>
          <PlusIcon />
          Nova atividade
        </Button>
      </div>
    </section>
  );
}

// ===========================================================================
// Cartão
// ===========================================================================

function CartaoAtividade({
  atividade,
  categoriasPorId,
  usuariosPorId,
  hoje,
  onAbrir,
}: {
  atividade: AtividadeQuadro;
  categoriasPorId: Map<string, CategoriaKanban>;
  usuariosPorId: Map<string, UsuarioSistema>;
  hoje: string;
  onAbrir: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: idAtividade(atividade.id),
    attributes: { roleDescription: "atividade arrastável" },
  });

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    listeners?.onKeyDown?.(e);
    if (e.key === "Enter" && !isDragging) {
      e.preventDefault();
      onAbrir();
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="relative"
    >
      <div
        {...attributes}
        {...listeners}
        onKeyDown={onKeyDown}
        onClick={onAbrir}
        className="rounded-lg outline-none"
      >
        <CartaoConteudo
          atividade={atividade}
          categoriasPorId={categoriasPorId}
          usuariosPorId={usuariosPorId}
          hoje={hoje}
          comMenu
          className={cn(
            "cursor-grab touch-manipulation active:cursor-grabbing",
            isDragging && "opacity-40",
          )}
        />
      </div>
      {/* Fora da área arrastável: o botão não dispara o arrasto nem abre o painel. */}
      {!isDragging && <MenuCartao atividade={atividade} onAbrir={onAbrir} />}
    </li>
  );
}

/** Menu "..." do cartão: abrir, ligar/desligar "Urgente" e concluir. */
function MenuCartao({ atividade, onAbrir }: { atividade: AtividadeQuadro; onAbrir: () => void }) {
  const [isPending, startTransition] = useTransition();

  function alternarUrgente() {
    const valor = !atividade.urgente;
    startTransition(async () => {
      const r = await executarAcao(() => marcarUrgente(atividade.id, valor));
      if (!r.ok) {
        toast.error("Não foi possível alterar \"Urgente\".", { description: r.error });
        return;
      }
      toast.success(valor ? "Marcada como urgente." : "Deixou de ser urgente.");
    });
  }

  function concluir() {
    startTransition(async () => {
      const r = await concluirAtividade(atividade.id);
      if (!r.ok) toast.error("Não foi possível concluir.", { description: r.error });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-2 right-2 text-muted-foreground"
          aria-label={`Ações da atividade ${atividade.titulo}`}
          disabled={isPending}
        >
          {isPending ? <Carregando decorativo tamanho="sm" /> : <MoreHorizontalIcon />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onAbrir}>
          <PanelRightOpenIcon />
          Abrir
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={alternarUrgente}>
          <SirenIcon />
          {atividade.urgente ? "Desmarcar urgente" : "Marcar como urgente"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={concluir}>
          <CircleCheckBigIcon />
          Concluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CartaoConteudo({
  atividade: a,
  categoriasPorId,
  usuariosPorId,
  hoje,
  comMenu,
  className,
}: {
  atividade: AtividadeQuadro;
  categoriasPorId: Map<string, CategoriaKanban>;
  usuariosPorId: Map<string, UsuarioSistema>;
  hoje: string;
  /** Deixa espaço no título para o botão "..." do cartão. */
  comMenu?: boolean;
  className?: string;
}) {
  const categorias = a.categorias
    .map((id) => categoriasPorId.get(id))
    .filter((c): c is CategoriaKanban => Boolean(c));
  const responsavel = a.responsavel_id ? usuariosPorId.get(a.responsavel_id) : undefined;
  const prazo = a.prazo ? situacaoPrazo(a.prazo, hoje) : null;

  return (
    <div
      className={cn(
        // min-w-0 + overflow-hidden: nada (e-mail, nome de categoria) alarga o cartão além da coluna.
        "grid min-w-0 gap-2 overflow-hidden rounded-lg border bg-cartao-kanban p-3 text-card-foreground shadow-xs transition-colors hover:border-ring/50 in-focus-visible:ring-3 in-focus-visible:ring-ring/50",
        // Urgente: faixa suave à esquerda, no tom pastel do vermelho.
        a.urgente && "border-l-4 border-l-etiqueta-vermelho-texto/40",
        className,
      )}
    >
      <p className={cn("min-w-0 text-sm leading-snug font-medium wrap-anywhere", comMenu && "pr-6")}>
        {a.titulo}
      </p>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {a.urgente && (
          <Etiqueta cor="vermelho">
            <SirenIcon aria-hidden className="size-3" />
            Urgente
          </Etiqueta>
        )}
        <SeloPrioridade prioridade={a.prioridade} />
        {categorias.map((c) => (
          <Etiqueta key={c.id} cor={c.cor}>
            {c.nome}
          </Etiqueta>
        ))}
      </div>

      {/*
        Rodapé: o responsável (avatar + nome curto) é o que encolhe, com
        reticências; prazo e comentários nunca encolhem e, sem espaço, descem
        para a linha de baixo (flex-wrap), alinhados à direita.
      */}
      {(a.responsavel_id || a.prazo || a.comentarios > 0) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {a.responsavel_id && (
            <span
              className="flex min-w-0 flex-1 basis-24 items-center gap-1.5"
              title={tituloUsuario(responsavel)}
            >
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.625rem] font-semibold text-secondary-foreground"
              >
                {iniciaisUsuario(responsavel)}
              </span>
              <span className="min-w-0 max-w-full truncate">
                <span className="sr-only">Responsável: </span>
                {nomeCurtoUsuario(responsavel)}
              </span>
            </span>
          )}
          {(a.prazo || a.comentarios > 0) && (
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {a.prazo &&
                (prazo === "vencido" ? (
                  <Etiqueta cor="vermelho" className="shrink-0">
                    <AlarmClockIcon aria-hidden className="size-3" />
                    Vencido em {formatarDataISO(a.prazo)}
                  </Etiqueta>
                ) : prazo === "hoje" ? (
                  <Etiqueta cor="amarelo" className="shrink-0">
                    <AlarmClockIcon aria-hidden className="size-3" />
                    Vence hoje
                  </Etiqueta>
                ) : (
                  <span className="flex shrink-0 items-center gap-1">
                    <CalendarIcon aria-hidden className="size-3" />
                    <span className="sr-only">Prazo: </span>
                    {formatarDataISO(a.prazo)}
                  </span>
                ))}
              {a.comentarios > 0 && (
                <span
                  title={`${a.comentarios} ${a.comentarios === 1 ? "comentário" : "comentários"}`}
                  className="flex shrink-0 items-center gap-0.5 tabular-nums"
                >
                  <MessageCircleIcon aria-hidden className="size-3.5" />
                  {a.comentarios}
                  <span className="sr-only">{a.comentarios === 1 ? " comentário" : " comentários"}</span>
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Arquivar coluna
// ===========================================================================

function ArquivarColunaDialog({
  coluna,
  atividadesAtivas,
  onFechar,
}: {
  coluna: ColunaQuadro | null;
  atividadesAtivas: number;
  onFechar: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const bloqueada = atividadesAtivas > 0;

  function arquivar() {
    if (!coluna) return;
    startTransition(async () => {
      const r = await executarAcao(() => arquivarColuna(coluna.id));
      if (!r.ok) {
        toast.error("Não foi possível arquivar a coluna.", { description: r.error });
        return;
      }
      toast.success(`Coluna "${coluna.nome}" arquivada.`);
      onFechar();
    });
  }

  return (
    <Dialog open={coluna !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arquivar Coluna?</DialogTitle>
          <DialogDescription>
            {bloqueada
              ? `A coluna "${coluna?.nome}" tem ${
                  atividadesAtivas === 1 ? "1 atividade ativa" : `${atividadesAtivas} atividades ativas`
                }. Mova ou conclua as atividades antes de arquivar a coluna.`
              : `A coluna "${coluna?.nome}" sai do quadro, mas continua guardada. Dá para restaurar em Atividades > Concluídas, na seção Colunas Arquivadas.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={isPending}>
            {bloqueada ? "Fechar" : "Cancelar"}
          </Button>
          {!bloqueada && (
            <Button variant="destructive" onClick={arquivar} disabled={isPending}>
              {isPending && <Carregando decorativo tamanho="sm" />}
              {isPending ? "Arquivando..." : "Arquivar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
