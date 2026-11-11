import { PencilIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";

import { LinkAnexoServico } from "@/components/link-anexo-servico";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarDataISO, formatarMoeda, hojeEmPalmas } from "@/lib/format";
import { servicosRepetidos } from "@/lib/servicos";
import { TIPO_SERVICO_LABEL, type ServicoRow } from "@/lib/types";

import { ServicoFormDialog } from "../servico-form-dialog";

type Props = {
  dispositivoId: string;
  /** Do mais recente para o mais antigo. */
  servicos: ServicoRow[];
};

/** Seção "Histórico de serviços" do detalhe do dispositivo. */
export function HistoricoServicos({ dispositivoId, servicos }: Props) {
  const total = servicos.length;
  const custoTotal = servicos.reduce((soma, s) => soma + (s.custo ?? 0), 0);
  const repetidos = servicosRepetidos(servicos, hojeEmPalmas());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de serviços</CardTitle>
        <CardDescription>
          {total === 0
            ? "Nenhum serviço registrado."
            : `${total} ${total === 1 ? "serviço" : "serviços"} · ${formatarMoeda(custoTotal)} em custo acumulado`}
        </CardDescription>
        <CardAction>
          <ServicoFormDialog
            dispositivoId={dispositivoId}
            trigger={
              <Button size="sm">
                <PlusIcon />
                Registrar serviço
              </Button>
            }
          />
        </CardAction>
      </CardHeader>

      {total > 0 && (
        <CardContent className="space-y-4">
          {repetidos.length > 0 && (
            <div
              role="status"
              className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-400"
            >
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Serviço repetido nos últimos 12 meses</p>
                <ul>
                  {repetidos.map((r) => (
                    <li key={r.tipo}>
                      {TIPO_SERVICO_LABEL[r.tipo]}: {r.vezes} vezes
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead>Garantia</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Anexo</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatarDataISO(s.data_servico)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{TIPO_SERVICO_LABEL[s.tipo]}</TableCell>
                  <TableCell>{s.fornecedor ?? <Traco />}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {s.custo !== null ? formatarMoeda(s.custo) : <Traco />}
                  </TableCell>
                  <TableCell>{s.na_garantia ? "Sim" : "Não"}</TableCell>
                  <TableCell className="min-w-48 text-sm whitespace-normal">
                    {s.descricao ?? <Traco />}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <LinkAnexoServico path={s.anexo_path} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ServicoFormDialog
                      dispositivoId={dispositivoId}
                      servico={s}
                      trigger={
                        <Button variant="ghost" size="sm">
                          <PencilIcon />
                          Editar
                          <span className="sr-only">
                            {" "}
                            {TIPO_SERVICO_LABEL[s.tipo]} de {formatarDataISO(s.data_servico)}
                          </span>
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

function Traco() {
  return <span className="text-muted-foreground">—</span>;
}
