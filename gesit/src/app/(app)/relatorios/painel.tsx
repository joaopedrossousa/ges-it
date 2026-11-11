"use client";

import { CalendarRangeIcon, FileWarningIcon, StoreIcon, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { ExportarBotoes } from "@/components/exportar";
import { MensagemErro } from "@/components/mensagem-erro";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS } from "@/hooks/use-filtros-url";
import type { LojaOpcao } from "@/lib/lojas";
import { TIPOS_DISPOSITIVO, TIPO_DISPOSITIVO_LABEL } from "@/lib/types";

type Props = {
  lojas: LojaOpcao[];
  /** Mês atual em Palmas (AAAA-MM-DD), calculado no servidor. */
  periodoPadrao: { de: string; ate: string };
};

/** "todos" (sem filtro) vira undefined na query string. */
const filtro = (valor: string) => (valor === TODOS ? undefined : valor);

export function PainelRelatorios({ lojas, periodoPadrao }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <PorLoja lojas={lojas} />
      <Movimentacoes periodoPadrao={periodoPadrao} />
      <SemTermo lojas={lojas} />
    </div>
  );
}

function CartaoRelatorio({
  icone: Icone,
  titulo,
  descricao,
  children,
  rodape,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  children: ReactNode;
  rodape: ReactNode;
}) {
  return (
    <Card className="border-t-2 border-t-brand-green">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icone className="size-4 text-brand-green" aria-hidden />
          {titulo}
        </CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="grid flex-1 content-start gap-4">{children}</CardContent>
      <CardFooter>{rodape}</CardFooter>
    </Card>
  );
}

function SelectLoja({ id, lojas, valor, onChange }: {
  id: string;
  lojas: LojaOpcao[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Loja</Label>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas as lojas</SelectItem>
          {lojas.map((loja) => (
            <SelectItem key={loja.id} value={loja.id}>
              {loja.nome}
              {!loja.ativo && " (inativa)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PorLoja({ lojas }: { lojas: LojaOpcao[] }) {
  const id = useId();
  const [loja, setLoja] = useState(TODOS);
  const [tipo, setTipo] = useState(TODOS);

  return (
    <CartaoRelatorio
      icone={StoreIcon}
      titulo="Dispositivos por loja"
      descricao="Vínculos em aberto agrupados pela loja do vínculo, com subtotal por loja."
      rodape={
        <ExportarBotoes
          relatorio="dispositivos-por-loja"
          params={{ loja: filtro(loja), tipo: filtro(tipo) }}
        />
      }
    >
      <SelectLoja id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
      <div className="grid gap-2">
        <Label htmlFor={`${id}-tipo`}>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger id={`${id}-tipo`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {TIPOS_DISPOSITIVO.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_DISPOSITIVO_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </CartaoRelatorio>
  );
}

function Movimentacoes({ periodoPadrao }: { periodoPadrao: Props["periodoPadrao"] }) {
  const id = useId();
  const [de, setDe] = useState(periodoPadrao.de);
  const [ate, setAte] = useState(periodoPadrao.ate);

  const erro = !de || !ate
    ? "Informe as duas datas."
    : de > ate
      ? "A data inicial deve ser anterior ou igual à final."
      : undefined;

  return (
    <CartaoRelatorio
      icone={CalendarRangeIcon}
      titulo="Movimentações por período"
      descricao="Entregas, transferências e devoluções, com quem fez cada operação."
      rodape={
        <ExportarBotoes relatorio="movimentacoes" params={{ de, ate }} desabilitado={Boolean(erro)} />
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-de`}>De</Label>
          <Input
            id={`${id}-de`}
            type="date"
            value={de}
            max={ate || undefined}
            onChange={(e) => setDe(e.target.value)}
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? `${id}-erro` : undefined}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-ate`}>Até</Label>
          <Input
            id={`${id}-ate`}
            type="date"
            value={ate}
            min={de || undefined}
            onChange={(e) => setAte(e.target.value)}
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? `${id}-erro` : undefined}
          />
        </div>
      </div>
      <MensagemErro id={`${id}-erro`} mensagem={erro} />
      <p className="text-xs text-muted-foreground">Padrão: mês atual. Horário de Palmas (TO).</p>
    </CartaoRelatorio>
  );
}

function SemTermo({ lojas }: { lojas: LojaOpcao[] }) {
  const id = useId();
  const [loja, setLoja] = useState(TODOS);

  return (
    <CartaoRelatorio
      icone={FileWarningIcon}
      titulo="Vínculos sem termo"
      descricao="Vínculos em aberto sem termo de responsabilidade, do mais antigo para o mais novo."
      rodape={<ExportarBotoes relatorio="vinculos-sem-termo" params={{ loja: filtro(loja) }} />}
    >
      <SelectLoja id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
    </CartaoRelatorio>
  );
}
