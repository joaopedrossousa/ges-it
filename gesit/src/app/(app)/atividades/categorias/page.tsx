import { PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Etiqueta } from "@/components/atividades/etiquetas";
import { TabelaCarregando } from "@/components/tabela-carregando";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COR_LABEL } from "@/lib/atividades";
import { listarCategoriasKanban } from "@/lib/atividades-servidor";
import { buscarTodas } from "@/lib/relatorios/comum";
import { createClient } from "@/lib/supabase/server";

import { CategoriaFormDialog } from "./categoria-form-dialog";

export const metadata: Metadata = { title: "Categorias de Atividades" };

export default function CategoriasPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">
            Etiquetas coloridas das atividades. Para tirar uma de uso, inative-a.
          </p>
        </div>
        <CategoriaFormDialog
          trigger={
            <Button>
              <PlusIcon />
              Nova categoria
            </Button>
          }
        />
      </div>

      <Suspense fallback={<TabelaCarregando colunas={5} />}>
        <TabelaCategorias />
      </Suspense>
    </div>
  );
}

async function TabelaCategorias() {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  const supabase = await createClient();

  let categorias, usos;
  try {
    [categorias, usos] = await Promise.all([
      listarCategoriasKanban(),
      // Categorias das atividades ativas (para a contagem de uso).
      buscarTodas((de, ate) =>
        supabase
          .from("kanban_atividade_categorias")
          .select("categoria_id, atividade_id, kanban_atividades!inner(arquivada)")
          .eq("kanban_atividades.arquivada", false)
          .order("categoria_id")
          .order("atividade_id")
          .range(de, ate),
      ),
    ]);
  } catch (e) {
    console.error("Erro ao listar categorias:", e);
    return <p className="text-destructive">Não foi possível carregar as categorias.</p>;
  }

  const contagem = new Map<string, number>();
  for (const u of usos) contagem.set(u.categoria_id, (contagem.get(u.categoria_id) ?? 0) + 1);
  const ordenadas = [...categorias].sort(
    (a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead>Cor</TableHead>
            <TableHead className="text-right">Atividades Ativas</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-0 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenadas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Nenhuma categoria cadastrada.
              </TableCell>
            </TableRow>
          )}
          {ordenadas.map((c) => (
            <TableRow key={c.id} className={c.ativa ? undefined : "opacity-60"}>
              <TableCell>
                <Etiqueta cor={c.cor}>{c.nome}</Etiqueta>
              </TableCell>
              <TableCell>{COR_LABEL[c.cor]}</TableCell>
              <TableCell className="text-right tabular-nums">{contagem.get(c.id) ?? 0}</TableCell>
              <TableCell>
                <Badge variant={c.ativa ? "secondary" : "outline"}>{c.ativa ? "Ativa" : "Inativa"}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <CategoriaFormDialog
                  categoria={c}
                  trigger={
                    <Button variant="ghost" size="sm">
                      <PencilIcon />
                      Editar<span className="sr-only"> {c.nome}</span>
                    </Button>
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
