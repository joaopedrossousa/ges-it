import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LinhaAuditoria } from "@/lib/auditoria-servidor";
import { formatarDataHora } from "@/lib/format";

type Props = {
  linhas: LinhaAuditoria[];
  /** Na página /auditoria: colunas de tipo e registro. Nos detalhes, não. */
  mostrarRegistro: boolean;
  vazio: string;
};

/** Log de auditoria, do mais recente para o mais antigo. */
export function TabelaAuditoria({ linhas, mostrarRegistro, vazio }: Props) {
  const colunas = mostrarRegistro ? 6 : 4;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data/hora</TableHead>
          <TableHead>Usuário</TableHead>
          <TableHead>Ação</TableHead>
          {mostrarRegistro && <TableHead>Tipo de registro</TableHead>}
          {mostrarRegistro && <TableHead>Registro</TableHead>}
          <TableHead>Alterações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.length === 0 && (
          <TableRow>
            <TableCell colSpan={colunas} className="py-8 text-center text-muted-foreground">
              {vazio}
            </TableCell>
          </TableRow>
        )}
        {linhas.map((l) => (
          <TableRow key={l.id} className="align-top">
            <TableCell className="whitespace-nowrap">{formatarDataHora(l.quando)}</TableCell>
            <TableCell className="max-w-56 truncate" title={l.usuario}>
              {l.usuario}
            </TableCell>
            <TableCell>
              <Badge
                className={
                  l.codigoAcao === "insercao"
                    ? "border-transparent bg-brand-green/15 text-brand-green-strong dark:bg-brand-green/20"
                    : "border-transparent bg-brand-blue/10 text-brand-blue dark:bg-primary/20 dark:text-primary"
                }
              >
                {l.acao}
              </Badge>
            </TableCell>
            {mostrarRegistro && <TableCell>{l.tipoRegistro}</TableCell>}
            {mostrarRegistro && (
              <TableCell className="min-w-48 whitespace-normal">
                {l.registro.href ? (
                  <Link href={l.registro.href} className="hover:underline">
                    {l.registro.texto}
                  </Link>
                ) : (
                  l.registro.texto
                )}
              </TableCell>
            )}
            <TableCell className="min-w-64 text-sm whitespace-normal">
              {l.alteracoes.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <ul className="space-y-0.5">
                  {l.alteracoes.map((a, i) => (
                    <li key={i}>
                      <span className="text-muted-foreground">{a.campo}:</span> {a.texto}
                    </li>
                  ))}
                </ul>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
