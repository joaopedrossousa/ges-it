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

export type LinhaHistorico = {
  id: string;
  /** Usado para anexar termo na pasta do dispositivo. */
  dispositivo_id: string;
  data_inicio: string;
  data_fim: string | null;
  termo_path: string | null;
  observacao: string | null;
  observacao_devolucao: string | null;
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
  const colunas = 7;

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
                <Badge className="border-transparent bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400">
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
                <AnexarTermoButton vinculoId={v.id} dispositivoId={v.dispositivo_id} />
              )}
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
