"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFiltrosUrl } from "@/hooks/use-filtros-url";
import { REGEX_MES, formatarMes, mesesAoRedor, somarMeses } from "@/lib/financeiro";

/**
 * Mês da competência em ?mes=AAAA-MM. Sem o parâmetro vale o mês atual
 * (calculado no servidor, em Palmas, e recebido em `mesAtual`).
 */
export function SeletorMes({ mesAtual }: { mesAtual: string }) {
  const { valor, atualizar, isPending } = useFiltrosUrl();
  const lido = valor("mes", mesAtual);
  const mes = REGEX_MES.test(lido) ? lido : mesAtual;

  // O mês atual não vai para a URL: o link fica limpo e "hoje" continua valendo.
  const ir = (novo: string) => atualizar("mes", novo === mesAtual ? "" : novo);

  return (
    <div className="flex items-center gap-1" aria-busy={isPending || undefined}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => ir(somarMeses(mes, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeftIcon />
      </Button>
      <Select value={mes} onValueChange={ir}>
        <SelectTrigger className="w-48" aria-label="Competência (mês)">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mesesAoRedor(mes).map((m) => (
            <SelectItem key={m} value={m}>
              {formatarMes(m)}
              {m === mesAtual && " (atual)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => ir(somarMeses(mes, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRightIcon />
      </Button>
      {mes !== mesAtual && (
        <Button type="button" variant="ghost" size="sm" onClick={() => ir(mesAtual)}>
          Mês atual
        </Button>
      )}
    </div>
  );
}
