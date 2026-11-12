import {
  ArrowRightLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  UserRoundPlusIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { StatusDispositivoBadge } from "@/components/status-dispositivo-badge";
import { TabelaCarregando } from "@/components/tabela-carregando";
import { VidaUtilBadge } from "@/components/vida-util-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paginacao, PaginaInexistente } from "@/components/paginacao";
import {
  faixaDaPagina,
  paginaDoParametro,
  primeiro,
} from "@/lib/busca";
import { identificadorDispositivo } from "@/lib/dispositivos";
import { filtroBuscaDispositivos, lerFiltrosDispositivos } from "@/lib/filtros-dispositivos";
import { listarLojasOpcoes } from "@/lib/lojas";
import { createClient } from "@/lib/supabase/server";
import {
  TIPO_DISPOSITIVO_LABEL,
  type VwDispositivoRow,
} from "@/lib/types";

import {
  DispositivoFormDialog,
  type DispositivoEditavel,
} from "./dispositivo-form-dialog";
import { ExportarDispositivos } from "./exportar-dispositivos";
import { Filtros } from "./filtros";
import { StatusDialog } from "./status-dialog";
import { VincularDialog } from "./vincular-dialog";

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
          <p className="text-muted-foreground">Notebooks, telefones e monitores.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* useSearchParams: precisa de Suspense no shell estático. */}
          <Suspense
            fallback={
              <Button variant="outline" disabled>
                <DownloadIcon />
                Exportar
              </Button>
            }
          >
            <ExportarDispositivos />
          </Suspense>
          <VincularDialog
            trigger={
              <Button variant="outline">
                <UserRoundPlusIcon />
                Vincular
              </Button>
            }
          />
          <Suspense
            fallback={
              <Button disabled>
                <PlusIcon />
                Novo dispositivo
              </Button>
            }
          >
            <NovoDispositivo />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<div className="h-8" />}>
        <BarraDeFiltros />
      </Suspense>

      <Suspense fallback={<TabelaCarregando colunas={8} />}>
        <TabelaDispositivos searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** O formulário precisa das lojas (filial de estoque). */
async function NovoDispositivo() {
  await connection(); // sessão (o Supabase lê Date.now()): só na requisição
  const lojas = await listarLojasOpcoes();
  return (
    <DispositivoFormDialog
      lojas={lojas}
      trigger={
        <Button>
          <PlusIcon />
          Novo dispositivo
        </Button>
      }
    />
  );
}

async function BarraDeFiltros() {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const lojas = await listarLojasOpcoes();
  return <Filtros lojas={lojas} />;
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
    numero_patrimonio: d.numero_patrimonio,
    numero_linha: d.numero_linha,
    operadora: d.operadora,
    data_compra: d.data_compra,
    fim_vida_util: d.fim_vida_util,
    nota_fiscal_path: d.nota_fiscal_path,
    loja_estoque_id: d.loja_estoque_id,
    observacao: d.observacao,
  };
}

async function TabelaDispositivos({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection(); // sessão (o Supabase lê Date.now()) e horário: só na requisição
  const params = await searchParams;
  const { busca, tipo, status, lojaId, vidaUtil } = lerFiltrosDispositivos(params);

  const pagina = paginaDoParametro(primeiro(params.page));
  const { de, ate } = faixaDaPagina(pagina);

  const lojasPromise = listarLojasOpcoes();
  const supabase = await createClient();
  let query = supabase
    .from("vw_dispositivos")
    .select("*", { count: "exact" })
    .order("tipo")
    .order("marca")
    .order("modelo")
    .order("id") // desempate estável entre páginas
    .range(de, ate);

  if (tipo) query = query.eq("tipo", tipo);
  if (status) query = query.eq("status", status);

  // Loja do vínculo aberto ou, sem vínculo, a filial de estoque (migration 014).
  if (lojaId) query = query.eq("loja_atual_id", lojaId);
  if (vidaUtil) query = query.eq("situacao_vida_util", vidaUtil);

  const filtroBusca = filtroBuscaDispositivos(busca);
  if (filtroBusca) query = query.or(filtroBusca);

  const [{ data, count, error }, lojas] = await Promise.all([query, lojasPromise]);

  if (error?.code === "PGRST103") {
    return <PaginaInexistente pathname="/dispositivos" params={params} />;
  }
  if (error) {
    console.error("Erro ao listar dispositivos:", error);
    return (
      <p className="text-destructive">
        Não foi possível carregar os dispositivos.
      </p>
    );
  }

  const filtrando = Boolean(busca || tipo || status || lojaId || vidaUtil);

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
              <TableHead>Vida útil</TableHead>
              <TableHead>Usuário / filial</TableHead>
              <TableHead className="w-0 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
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
                  <TableCell className="font-medium">
                    {d.id ? (
                      <Link href={`/dispositivos/${d.id}`} className="hover:underline">
                        {d.marca ?? "—"}
                      </Link>
                    ) : (
                      (d.marca ?? "—")
                    )}
                  </TableCell>
                  <TableCell>{d.modelo ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {identificadorDispositivo(d)}
                  </TableCell>
                  <TableCell>
                    <StatusDispositivoBadge status={d.status} />
                  </TableCell>
                  <TableCell>
                    <VidaUtilBadge situacao={d.situacao_vida_util} />
                  </TableCell>
                  <TableCell>
                    {d.colaborador_nome ? (
                      <div className="leading-tight">
                        <div>{d.colaborador_nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.loja_nome ?? "—"}
                        </div>
                      </div>
                    ) : d.loja_atual_nome ? (
                      <div className="leading-tight">
                        <div className="text-muted-foreground">
                          {d.status === "baixado" ? "Sem usuário" : "Em estoque"}
                        </div>
                        <div className="text-xs text-muted-foreground">{d.loja_atual_nome}</div>
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
                          lojas={lojas}
                          trigger={
                            <Button variant="ghost" size="sm">
                              <PencilIcon />
                              Editar<span className="sr-only"> {editavel.marca} {editavel.modelo}</span>
                            </Button>
                          }
                        />
                        <StatusDialog
                          dispositivo={{
                            id: editavel.id,
                            descricao: `${editavel.marca} ${editavel.modelo} · ${identificadorDispositivo(d)}`,
                            status: d.status,
                            colaboradorNome: d.colaborador_nome,
                          }}
                          trigger={
                            <Button variant="ghost" size="sm">
                              <ArrowRightLeftIcon />
                              Status<span className="sr-only"> {editavel.marca} {editavel.modelo}</span>
                            </Button>
                          }
                        />
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dispositivos/${editavel.id}`}>
                            Detalhes<span className="sr-only"> {editavel.marca} {editavel.modelo}</span>
                            <ChevronRightIcon />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Paginacao
        pathname="/dispositivos"
        params={params}
        pagina={pagina}
        total={count ?? data.length}
        rotulo={["dispositivo", "dispositivos"]}
      />
    </div>
  );
}
