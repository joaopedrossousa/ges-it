import Link from "next/link";

import { AnexarTermoButton } from "@/components/anexar-termo-button";
import { LinkTermo } from "@/components/link-termo";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarDataHora, formatarDuracao } from "@/lib/format";
import {
  naoDevolvidos,
  rotulosPerifericos,
  temConferencia,
  textoDevolvidos,
  textoEntregues,
  textoFormatado,
} from "@/lib/perifericos";
import type { TipoDispositivo } from "@/lib/types";

export type LinhaHistorico = {
  id: string;
  /** Usados para anexar termo em {dispositivo_id}/{timestamp}_{colaborador_id}.pdf. */
  dispositivo_id: string;
  colaborador_id: string;
  data_inicio: string;
  data_fim: string | null;
  termo_path: string | null;
  observacao: string | null;
  observacao_devolucao: string | null;
  perifericos_entrega: string[];
  /** Null enquanto aberto e em encerramentos sem conferência (transferência). */
  perifericos_devolucao: string[] | null;
  formatado_entrega: boolean | null;
  formatado_devolucao: boolean | null;
  /** Monitor não tem periféricos nem "formatado". */
  tipo_dispositivo: TipoDispositivo | null;
  /** Loja gravada no vínculo (não a loja atual do colaborador). */
  loja_nome: string | null;
  colaborador?: { id: string; nome: string } | null;
  dispositivo?: { id: string; descricao: string; identificador: string } | null;
};

type Props = {
  /** "dispositivo": mostra colunas do colaborador; "colaborador": do dispositivo. */
  contexto: "dispositivo" | "colaborador";
  linhas: LinhaHistorico[];
  /** Momento da requisição, para a duração de vínculos em aberto. */
  agora: Date;
};

/** Histórico de vínculos, do mais recente para o mais antigo. */
export function HistoricoVinculos({ contexto, linhas, agora }: Props) {
  const colunas = 10;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{contexto === "dispositivo" ? "Colaborador" : "Dispositivo"}</TableHead>
          <TableHead>Loja</TableHead>
          <TableHead>Início</TableHead>
          <TableHead>Fim</TableHead>
          <TableHead>Duração</TableHead>
          <TableHead>Termo</TableHead>
          <TableHead>Periféricos entregues</TableHead>
          <TableHead>Periféricos devolvidos</TableHead>
          <TableHead>Formatado</TableHead>
          <TableHead>Observações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.length === 0 && (
          <TableRow>
            <TableCell colSpan={colunas} className="py-8 text-center text-muted-foreground">
              Nenhum vínculo registrado.
            </TableCell>
          </TableRow>
        )}
        {linhas.map((v) => (
          <TableRow key={v.id}>
            {contexto === "dispositivo" ? (
              <TableCell className="font-medium">
                {v.colaborador ? (
                  <Link
                    href={`/colaboradores/${v.colaborador.id}`}
                    className="hover:underline"
                  >
                    {v.colaborador.nome}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
            ) : (
              <TableCell>
                {v.dispositivo ? (
                  <Link
                    href={`/dispositivos/${v.dispositivo.id}`}
                    className="leading-tight hover:underline"
                  >
                    <span className="block font-medium">{v.dispositivo.descricao}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {v.dispositivo.identificador}
                    </span>
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
            )}
            <TableCell>{v.loja_nome ?? "—"}</TableCell>
            <TableCell className="whitespace-nowrap">
              {formatarDataHora(v.data_inicio)}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {v.data_fim ? (
                formatarDataHora(v.data_fim)
              ) : (
                <Badge className="border-transparent bg-brand-blue/10 text-brand-blue dark:bg-primary/20 dark:text-primary">
                  Em uso
                </Badge>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatarDuracao(
                v.data_inicio,
                v.data_fim ? new Date(v.data_fim) : agora,
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {v.termo_path ? (
                <LinkTermo path={v.termo_path} />
              ) : (
                <AnexarTermoButton
                  vinculoId={v.id}
                  dispositivoId={v.dispositivo_id}
                  colaboradorId={v.colaborador_id}
                />
              )}
            </TableCell>
            <TableCell className="min-w-32 text-sm whitespace-normal">
              <TextoOuTraco texto={textoEntregues(v.tipo_dispositivo, v.perifericos_entrega)} />
            </TableCell>
            <TableCell className="min-w-32 text-sm whitespace-normal">
              <Devolvidos v={v} />
            </TableCell>
            <TableCell className="min-w-28 text-sm whitespace-normal">
              <TextoOuTraco
                texto={
                  temConferencia(v.tipo_dispositivo)
                    ? textoFormatado(v.formatado_entrega, v.formatado_devolucao)
                    : "—"
                }
              />
            </TableCell>
            <TableCell className="min-w-48 text-sm whitespace-normal">
              {v.observacao || v.observacao_devolucao ? (
                <div className="space-y-1">
                  {v.observacao && (
                    <p>
                      <span className="text-muted-foreground">Entrega: </span>
                      {v.observacao}
                    </p>
                  )}
                  {v.observacao_devolucao && (
                    <p>
                      <span className="text-muted-foreground">Devolução: </span>
                      {v.observacao_devolucao}
                    </p>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TextoOuTraco({ texto }: { texto: string }) {
  return texto === "—" ? <span className="text-muted-foreground">—</span> : <>{texto}</>;
}

/** Devolvidos + o que ficou faltando em relação à entrega. */
function Devolvidos({ v }: { v: LinhaHistorico }) {
  const texto = textoDevolvidos(v.tipo_dispositivo, v);
  if (texto === "—" || texto === "Não conferido") {
    return <span className="text-muted-foreground">{texto}</span>;
  }
  const faltando = naoDevolvidos(v.perifericos_entrega, v.perifericos_devolucao);
  return (
    <div className="space-y-1">
      <p>{texto}</p>
      {faltando.length > 0 && (
        <p className="text-amber-800 dark:text-amber-400">
          Não devolvido: {rotulosPerifericos(faltando)}
        </p>
      )}
    </div>
  );
}
