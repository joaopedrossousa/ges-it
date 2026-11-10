import { ArrowRightLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";

import { StatusDispositivoBadge } from "@/components/status-dispositivo-badge";
import { TabelaCarregando } from "@/components/tabela-carregando";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listarLojasOpcoes } from "@/lib/lojas";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_DISPOSITIVO,
  TIPOS_DISPOSITIVO,
  TIPO_DISPOSITIVO_LABEL,
  type VwDispositivoRow,
} from "@/lib/types";
import { formatarIMEI, somenteDigitos } from "@/lib/validators";

import {
  DispositivoFormDialog,
  type DispositivoEditavel,
} from "./dispositivo-form-dialog";
import { Filtros } from "./filtros";
import { StatusDialog } from "./status-dialog";

export const metadata: Metadata = { title: "Dispositivos" };

type SearchParams = PageProps<"/dispositivos">["searchParams"];

export default function DispositivosPage({
  searchParams,
}: PageProps<"/dispositivos">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dispositivos</h1>
          <p className="text-muted-foreground">Notebooks e telefones.</p>
        </div>
        <DispositivoFormDialog
          trigger={
            <Button>
              <PlusIcon />
              Novo dispositivo
            </Button>
          }
        />
      </div>

      <Suspense fallback={<div className="h-8" />}>
        <BarraDeFiltros />
      </Suspense>

      <Suspense fallback={<TabelaCarregando colunas={7} />}>
        <TabelaDispositivos searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BarraDeFiltros() {
  const lojas = await listarLojasOpcoes();
  return <Filtros lojas={lojas} />;
}

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Remove caracteres com significado na sintaxe de filtros do PostgREST. */
function limparBusca(valor: string) {
  return valor.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim();
}

const tipoSchema = z.enum(TIPOS_DISPOSITIVO);
const statusSchema = z.enum(STATUS_DISPOSITIVO);

function identificador(d: VwDispositivoRow) {
  if (d.tipo === "telefone" && d.imei1) return formatarIMEI(d.imei1);
  return d.serial_number ?? (d.imei1 ? formatarIMEI(d.imei1) : "—");
}

/** Linhas da view vêm com colunas anuláveis; só edita se os dados básicos existirem. */
function paraEdicao(d: VwDispositivoRow): DispositivoEditavel | null {
  if (!d.id || !d.tipo || d.marca === null || d.modelo === null) return null;
  return {
    id: d.id,
    tipo: d.tipo,
    marca: d.marca,
    modelo: d.modelo,
    serial_number: d.serial_number,
    imei1: d.imei1,
    imei2: d.imei2,
    observacao: d.observacao,
  };
}

async function TabelaDispositivos({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const busca = limparBusca(primeiro(params.q) ?? "").slice(0, 100);
  const tipo = tipoSchema.safeParse(primeiro(params.tipo)).data;
  const status = statusSchema.safeParse(primeiro(params.status)).data;
  const lojaParam = primeiro(params.loja);
  const lojaId = z.uuid().safeParse(lojaParam).success ? lojaParam : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("vw_dispositivos")
    .select("*")
    .order("tipo")
    .order("marca")
    .order("modelo");

  if (tipo) query = query.eq("tipo", tipo);
  if (status) query = query.eq("status", status);

  if (lojaId) {
    // A view expõe só o nome da loja (único no banco).
    const lojas = await listarLojasOpcoes();
    const loja = lojas.find((l) => l.id === lojaId);
    query = query.eq("loja_nome", loja?.nome ?? "");
  }

  if (busca) {
    const filtros = [
      `marca.ilike.%${busca}%`,
      `modelo.ilike.%${busca}%`,
      `serial_number.ilike.%${busca}%`,
    ];
    const digitos = somenteDigitos(busca);
    if (digitos.length >= 3) {
      filtros.push(`imei1.like.%${digitos}%`, `imei2.like.%${digitos}%`);
    }
    query = query.or(filtros.join(","));
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao listar dispositivos:", error);
    return (
      <p className="text-destructive">
        Não foi possível carregar os dispositivos.
      </p>
    );
  }

  const filtrando = Boolean(busca || tipo || status || lojaId);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Identificador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usuário atual</TableHead>
              <TableHead className="w-0 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  {filtrando
                    ? "Nenhum dispositivo encontrado com esses filtros."
                    : "Nenhum dispositivo cadastrado."}
                </TableCell>
              </TableRow>
            )}
            {data.map((d, i) => {
              const editavel = paraEdicao(d);
              return (
                <TableRow
                  key={d.id ?? i}
                  className={d.status === "baixado" ? "opacity-60" : undefined}
                >
                  <TableCell>{d.tipo ? TIPO_DISPOSITIVO_LABEL[d.tipo] : "—"}</TableCell>
                  <TableCell className="font-medium">{d.marca ?? "—"}</TableCell>
                  <TableCell>{d.modelo ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{identificador(d)}</TableCell>
                  <TableCell>
                    <StatusDispositivoBadge status={d.status} />
                  </TableCell>
                  <TableCell>
                    {d.colaborador_nome ? (
                      <div className="leading-tight">
                        <div>{d.colaborador_nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.loja_nome ?? "—"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editavel && d.status && (
                      <div className="flex justify-end gap-1">
                        <DispositivoFormDialog
                          dispositivo={editavel}
                          trigger={
                            <Button variant="ghost" size="sm">
                              <PencilIcon />
                              Editar
                            </Button>
                          }
                        />
                        <StatusDialog
                          dispositivo={{
                            id: editavel.id,
                            descricao: `${editavel.marca} ${editavel.modelo} · ${identificador(d)}`,
                            status: d.status,
                            colaboradorNome: d.colaborador_nome,
                          }}
                          trigger={
                            <Button variant="ghost" size="sm">
                              <ArrowRightLeftIcon />
                              Status
                            </Button>
                          }
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        {data.length} {data.length === 1 ? "dispositivo" : "dispositivos"}
      </p>
    </div>
  );
}
