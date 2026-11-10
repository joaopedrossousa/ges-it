import { PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

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
import { createClient } from "@/lib/supabase/server";

import { LojaFormDialog } from "./loja-form-dialog";

export const metadata: Metadata = { title: "Lojas" };

export default function LojasPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Lojas</h1>
          <p className="text-muted-foreground">Matriz e filiais.</p>
        </div>
        <LojaFormDialog
          trigger={
            <Button>
              <PlusIcon />
              Nova loja
            </Button>
          }
        />
      </div>

      <Suspense fallback={<TabelaCarregando colunas={4} />}>
        <TabelaLojas />
      </Suspense>
    </div>
  );
}

async function TabelaLojas() {
  const supabase = await createClient();
  const { data: lojas, error } = await supabase
    .from("lojas")
    .select("id, nome, cidade, ativo")
    .order("nome");

  if (error) {
    console.error("Erro ao listar lojas:", error);
    return (
      <p className="text-destructive">Não foi possível carregar as lojas.</p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-0 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lojas.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                Nenhuma loja cadastrada.
              </TableCell>
            </TableRow>
          )}
          {lojas.map((loja) => (
            <TableRow key={loja.id}>
              <TableCell className="font-medium">{loja.nome}</TableCell>
              <TableCell>{loja.cidade ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={loja.ativo ? "secondary" : "outline"}>
                  {loja.ativo ? "Ativa" : "Inativa"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <LojaFormDialog
                  loja={loja}
                  trigger={
                    <Button variant="ghost" size="sm">
                      <PencilIcon />
                      Editar<span className="sr-only"> {loja.nome}</span>
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
