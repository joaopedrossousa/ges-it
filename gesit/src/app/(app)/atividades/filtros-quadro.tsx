"use client";

import { ArchiveIcon, SirenIcon, XIcon } from "lucide-react";
import Link from "next/link";

import { CampoBusca } from "@/components/campo-busca";
import { ComboboxLista } from "@/components/combobox-lista";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS } from "@/hooks/use-filtros-url";
import {
  PRIORIDADE_LABEL,
  SEM_RESPONSAVEL,
  nomeUsuario,
  temFiltro,
  type CategoriaKanban,
  type FiltrosQuadro,
  type UsuarioSistema,
} from "@/lib/atividades";
import { PRIORIDADES_ATIVIDADE } from "@/lib/types";

/** Filtros do quadro: aplicados no navegador, sem recarregar a página. */
export function BarraFiltros({
  filtros,
  onChange,
  onLimpar,
  categorias,
  usuarios,
}: {
  filtros: FiltrosQuadro;
  onChange: (chave: keyof FiltrosQuadro, valor: string) => void;
  onLimpar: () => void;
  categorias: CategoriaKanban[];
  usuarios: UsuarioSistema[];
}) {
  const opcoesCategorias = [
    { value: TODOS, label: "Todas as categorias" },
    ...categorias
      .filter((c) => c.ativa || c.id === filtros.categoria)
      .map((c) => ({ value: c.id, label: c.ativa ? c.nome : `${c.nome} (inativa)` })),
  ];
  const opcoesUsuarios = [
    { value: TODOS, label: "Todos os responsáveis" },
    { value: SEM_RESPONSAVEL, label: "Sem responsável" },
    ...usuarios.map((u) => ({ value: u.id, label: nomeUsuario(u), descricao: u.email })),
  ];
  const valor = (v: string) => v || TODOS;
  const gravar = (chave: keyof FiltrosQuadro) => (v: string) => onChange(chave, v === TODOS ? "" : v);

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      {/* key: "Limpar filtros" também limpa o texto digitado. */}
      <CampoBusca
        key={filtros.q ? "busca" : "busca-vazia"}
        valorInicial={filtros.q}
        placeholder="Buscar no título"
        onBuscar={gravar("q")}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 lg:flex">
        <ComboboxLista
          opcoes={opcoesCategorias}
          value={valor(filtros.categoria)}
          onChange={gravar("categoria")}
          ariaLabel="Filtrar por categoria"
          placeholderBusca="Buscar categoria..."
          vazio="Nenhuma categoria encontrada."
          className="lg:w-52"
        />

        <Select value={valor(filtros.prioridade)} onValueChange={gravar("prioridade")}>
          <SelectTrigger className="w-full lg:w-44" aria-label="Filtrar por prioridade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as prioridades</SelectItem>
            {PRIORIDADES_ATIVIDADE.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORIDADE_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ComboboxLista
          opcoes={opcoesUsuarios}
          value={valor(filtros.responsavel)}
          onChange={gravar("responsavel")}
          ariaLabel="Filtrar por responsável"
          placeholderBusca="Buscar usuário..."
          vazio="Nenhum usuário encontrado."
          className="lg:w-56"
        />

        <Button
          type="button"
          variant={filtros.urgente ? "default" : "outline"}
          aria-pressed={Boolean(filtros.urgente)}
          onClick={() => onChange("urgente", filtros.urgente ? "" : "1")}
        >
          <SirenIcon />
          Urgentes
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 lg:ml-auto">
        {temFiltro(filtros) && (
          <Button variant="ghost" onClick={onLimpar}>
            <XIcon />
            Limpar filtros
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/atividades/arquivadas">
            <ArchiveIcon />
            Ver arquivadas
          </Link>
        </Button>
      </div>
    </div>
  );
}
