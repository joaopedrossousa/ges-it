import {
  ArchiveXIcon,
  ArrowRightLeftIcon,
  UndoIcon,
  UserRoundPlusIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { listarUsuariosSistema } from "@/lib/atividades-servidor";
import { nomeDispositivo } from "@/lib/dispositivos";
import { formatarDataHora } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { nomeDoAutor, nomesDeUsuarios } from "@/lib/usuarios-servidor";
import { MOTIVO_BAIXA_LABEL, type MotivoBaixa, type TipoDispositivo } from "@/lib/types";

import { Bloco, ErroBloco, ItemBloco, ListaBloco, TudoEmDia, falhaDoBloco } from "./bloco";

const LIMITE = 8;
const DIAS = 7;

/** Texto gravado por vincular_dispositivo ao encerrar o vínculo anterior. */
const ENCERRADO_POR_TRANSFERENCIA = "Encerrado por transferência";

const DISPOSITIVO = "dispositivo:dispositivos(tipo, marca, modelo, equipamento)";

type Dispositivo = {
  tipo: TipoDispositivo;
  marca: string | null;
  modelo: string;
  equipamento: string | null;
} | null;

type Evento = {
  chave: string;
  tipo: "entrega" | "transferencia" | "devolucao" | "baixa";
  quando: string;
  dispositivoId: string;
  dispositivo: Dispositivo;
  /** Entrega: para quem; devolução: de quem; transferência: de/para. */
  de?: string | null;
  para?: string | null;
  motivo?: MotivoBaixa;
  por: string | null;
};

const EVENTO: Record<Evento["tipo"], { rotulo: string; icone: LucideIcon }> = {
  entrega: { rotulo: "Entrega", icone: UserRoundPlusIcon },
  transferencia: { rotulo: "Transferência", icone: ArrowRightLeftIcon },
  devolucao: { rotulo: "Devolução", icone: UndoIcon },
  baixa: { rotulo: "Baixa", icone: ArchiveXIcon },
};

/**
 * Últimos vínculos, transferências, devoluções e baixas de dispositivos, com
 * a contagem dos últimos 7 dias. Transferência = vínculo encerrado "por
 * transferência" e o novo vínculo do mesmo aparelho no mesmo instante.
 */
async function carregarMovimentacoes() {
  const supabase = await createClient();
  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000).toISOString();
  const contar = { count: "exact" as const, head: true };

  const [criados, encerrados, baixas, nCriados, nEncerrados, nTransferencias, nBaixas] =
    await Promise.all([
      supabase
        .from("vinculos")
        .select(`id, dispositivo_id, data_inicio, criado_por, colaborador:colaboradores(nome), ${DISPOSITIVO}`)
        .order("data_inicio", { ascending: false })
        .order("id")
        .limit(LIMITE),
      supabase
        .from("vinculos")
        .select(
          `id, dispositivo_id, data_fim, encerrado_por, observacao_devolucao, colaborador:colaboradores(nome), ${DISPOSITIVO}`,
        )
        .not("data_fim", "is", null)
        .order("data_fim", { ascending: false })
        .order("id")
        .limit(LIMITE),
      supabase
        .from("dispositivo_baixas")
        .select(`id, dispositivo_id, motivo, created_at, criado_por, ${DISPOSITIVO}`)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(LIMITE),
      supabase.from("vinculos").select("id", contar).gte("data_inicio", desde),
      supabase.from("vinculos").select("id", contar).gte("data_fim", desde),
      supabase
        .from("vinculos")
        .select("id", contar)
        .gte("data_fim", desde)
        .eq("observacao_devolucao", ENCERRADO_POR_TRANSFERENCIA),
      supabase.from("dispositivo_baixas").select("id", contar).gte("created_at", desde),
      // Usuários do sistema junto (cache da requisição): nomesDeUsuarios, no
      // fim, já os encontra prontos, sem outra ida ao banco.
      listarUsuariosSistema().catch(() => []),
    ]);
  const erro = [criados, encerrados, baixas, nCriados, nEncerrados, nTransferencias, nBaixas].find(
    (r) => r.error,
  )?.error;
  if (erro) throw erro;
  const listaCriados = criados.data ?? [];
  const listaEncerrados = encerrados.data ?? [];
  const listaBaixas = baixas.data ?? [];

  // Transferência: junta a saída (encerrado) com a entrada (novo vínculo).
  const usados = new Set<string>();
  const eventos: Evento[] = [];
  for (const v of listaEncerrados) {
    if (!v.data_fim) continue;
    if (v.observacao_devolucao === ENCERRADO_POR_TRANSFERENCIA) {
      const novo = listaCriados.find(
        (c) => c.dispositivo_id === v.dispositivo_id && c.data_inicio === v.data_fim,
      );
      if (novo) usados.add(novo.id);
      eventos.push({
        chave: `t-${v.id}`,
        tipo: "transferencia",
        quando: v.data_fim,
        dispositivoId: v.dispositivo_id,
        dispositivo: v.dispositivo,
        de: v.colaborador?.nome,
        para: novo?.colaborador?.nome,
        por: novo?.criado_por ?? v.encerrado_por,
      });
    } else {
      eventos.push({
        chave: `d-${v.id}`,
        tipo: "devolucao",
        quando: v.data_fim,
        dispositivoId: v.dispositivo_id,
        dispositivo: v.dispositivo,
        de: v.colaborador?.nome,
        por: v.encerrado_por,
      });
    }
  }
  for (const c of listaCriados) {
    if (usados.has(c.id)) continue;
    eventos.push({
      chave: `e-${c.id}`,
      tipo: "entrega",
      quando: c.data_inicio,
      dispositivoId: c.dispositivo_id,
      dispositivo: c.dispositivo,
      para: c.colaborador?.nome,
      por: c.criado_por,
    });
  }
  for (const b of listaBaixas) {
    eventos.push({
      chave: `b-${b.id}`,
      tipo: "baixa",
      quando: b.created_at,
      dispositivoId: b.dispositivo_id,
      dispositivo: b.dispositivo,
      motivo: b.motivo,
      por: b.criado_por,
    });
  }
  const recentes = eventos.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, LIMITE);

  // Quem fez: nome de exibição (Administração > Usuários), e-mail no title.
  const autores = await nomesDeUsuarios(
    supabase,
    recentes.map((e) => e.por),
  );

  const transferencias = nTransferencias.count ?? 0;
  const contagens = [
    {
      rotulo: "Vínculos",
      ajuda: "Novos vínculos (entregas e transferências)",
      n: nCriados.count ?? 0,
      href: "/relatorios",
    },
    { rotulo: "Transferências", ajuda: "Trocas de colaborador", n: transferencias, href: "/relatorios" },
    {
      rotulo: "Devoluções",
      ajuda: "Vínculos encerrados por devolução",
      n: Math.max(0, (nEncerrados.count ?? 0) - transferencias),
      href: "/relatorios",
    },
    { rotulo: "Baixas", ajuda: "Dispositivos baixados", n: nBaixas.count ?? 0, href: "/dispositivos?status=baixado" },
  ];

  return { recentes, autores, contagens };
}

export async function ResumoMovimentacoes() {
  await connection(); // sessão (o Supabase lê Date.now()) e janela de 7 dias: só na requisição
  const titulo = "Resumo de Movimentações";
  const dados = await carregarMovimentacoes().catch(falhaDoBloco(titulo));
  if (!dados) return <ErroBloco titulo={titulo} icone={ArrowRightLeftIcon} />;
  const { recentes, autores, contagens } = dados;

  return (
    <Bloco
      titulo={titulo}
      icone={ArrowRightLeftIcon}
      descricao={`Dispositivos: últimos eventos e a contagem dos últimos ${DIAS} dias.`}
      acao={{ href: "/", rotulo: "Ver dashboard" }}
    >
      <div className="grid gap-4">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={`Últimos ${DIAS} dias`}>
          {contagens.map((c) => (
            <li key={c.rotulo}>
              <Link
                href={c.href}
                title={c.ajuda}
                className="flex flex-col rounded-lg border px-3 py-2 transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="text-2xl font-semibold tabular-nums">{c.n}</span>
                <span className="text-xs text-muted-foreground">{c.rotulo}</span>
              </Link>
            </li>
          ))}
        </ul>

        {recentes.length === 0 ? (
          <TudoEmDia>Nenhuma movimentação de dispositivos registrada.</TudoEmDia>
        ) : (
          <ListaBloco>
            {recentes.map((e) => {
              const { rotulo, icone: Icone } = EVENTO[e.tipo];
              const item = e.dispositivo ? nomeDispositivo(e.dispositivo) : "Dispositivo";
              const autor = nomeDoAutor(autores, e.por);
              return (
                <ItemBloco key={e.chave} href={`/dispositivos/${e.dispositivoId}`}>
                  <Icone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">
                      <span className="font-medium">{rotulo}</span> · {item}
                      {e.tipo === "entrega" && e.para && ` para ${e.para}`}
                      {e.tipo === "devolucao" && e.de && ` de ${e.de}`}
                      {e.tipo === "transferencia" &&
                        `${e.de ? ` de ${e.de}` : ""}${e.para ? ` para ${e.para}` : ""}`}
                      {e.tipo === "baixa" && e.motivo && ` (${MOTIVO_BAIXA_LABEL[e.motivo]})`}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatarDataHora(e.quando)}
                      {autor && (
                        <span title={autor.email ?? undefined}> · por {autor.nome}</span>
                      )}
                    </span>
                  </span>
                </ItemBloco>
              );
            })}
          </ListaBloco>
        )}
      </div>
    </Bloco>
  );
}
