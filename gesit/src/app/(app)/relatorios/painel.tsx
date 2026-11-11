"use client";

import {
  CalendarRangeIcon,
  FileWarningIcon,
  StoreIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { CampoData } from "@/components/campo-data";
import { ComboboxLista } from "@/components/combobox-lista";
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
import { opcoesLojas } from "@/lib/opcoes-lojas";
import {
  TIPOS_DISPOSITIVO,
  TIPOS_SERVICO,
  TIPO_DISPOSITIVO_LABEL,
  TIPO_SERVICO_LABEL,
} from "@/lib/types";

type Props = {
  lojas: LojaOpcao[];
  /** Mês atual em Palmas (AAAA-MM-DD), calculado no servidor. */
  periodoPadrao: { de: string; ate: string };
};

/** "todos" (sem filtro) vira undefined na query string. */
const filtro = (valor: string) => (valor === TODOS ? undefined : valor);

export function PainelRelatorios({ lojas, periodoPadrao }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PorLoja lojas={lojas} />
      <Movimentacoes periodoPadrao={periodoPadrao} />
      <SemTermo lojas={lojas} />
      <Servicos lojas={lojas} periodoPadrao={periodoPadrao} />
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
      <ComboboxLista
        id={id}
        opcoes={opcoesLojas(lojas, { todas: true })}
        value={valor}
        onChange={onChange}
        placeholderBusca="Buscar loja ou cidade..."
        vazio="Nenhuma loja encontrada."
      />
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

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Datas do período e a validação "de ≤ até". */
function usePeriodo(padrao: Props["periodoPadrao"]) {
  const [de, setDe] = useState(padrao.de);
  const [ate, setAte] = useState(padrao.ate);
  const erro = !de || !ate
    ? "Informe as duas datas."
    : !DATA_ISO.test(de) || !DATA_ISO.test(ate)
      ? "Data inválida. Use dd/mm/aaaa."
      : de > ate
        ? "A data inicial deve ser anterior ou igual à final."
        : undefined;
  return { de, ate, setDe, setAte, erro };
}

function CamposPeriodo({
  id,
  periodo,
}: {
  id: string;
  periodo: ReturnType<typeof usePeriodo>;
}) {
  const { de, ate, setDe, setAte, erro } = periodo;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-de`}>De</Label>
          <CampoData
            id={`${id}-de`}
            value={de}
            max={DATA_ISO.test(ate) ? ate : undefined}
            onChange={setDe}
            emitirInvalido
            invalid={Boolean(erro)}
            descritoPor={erro ? `${id}-erro` : undefined}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-ate`}>Até</Label>
          <CampoData
            id={`${id}-ate`}
            value={ate}
            min={DATA_ISO.test(de) ? de : undefined}
            onChange={setAte}
            emitirInvalido
            invalid={Boolean(erro)}
            descritoPor={erro ? `${id}-erro` : undefined}
          />
        </div>
      </div>
      <MensagemErro id={`${id}-erro`} mensagem={erro} />
    </>
  );
}

function Movimentacoes({ periodoPadrao }: { periodoPadrao: Props["periodoPadrao"] }) {
  const id = useId();
  const periodo = usePeriodo(periodoPadrao);

  return (
    <CartaoRelatorio
      icone={CalendarRangeIcon}
      titulo="Movimentações por período"
      descricao="Entregas, transferências e devoluções, com quem fez cada operação."
      rodape={
        <ExportarBotoes
          relatorio="movimentacoes"
          params={{ de: periodo.de, ate: periodo.ate }}
          desabilitado={Boolean(periodo.erro)}
        />
      }
    >
      <CamposPeriodo id={id} periodo={periodo} />
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

const OPCOES_TIPO_SERVICO = [
  { value: TODOS, label: "Todos os tipos" },
  ...TIPOS_SERVICO.map((t) => ({ value: t, label: TIPO_SERVICO_LABEL[t] })),
];

function Servicos({ lojas, periodoPadrao }: Props) {
  const id = useId();
  const periodo = usePeriodo(periodoPadrao);
  const [tipo, setTipo] = useState(TODOS);
  const [loja, setLoja] = useState(TODOS);

  return (
    <CartaoRelatorio
      icone={WrenchIcon}
      titulo="Serviços por período"
      descricao="Manutenções dos dispositivos, com prestador de serviço, custo e garantia. A loja é a do vínculo na data do serviço."
      rodape={
        <ExportarBotoes
          relatorio="servicos"
          params={{
            de: periodo.de,
            ate: periodo.ate,
            tipo: filtro(tipo),
            loja: filtro(loja),
          }}
          desabilitado={Boolean(periodo.erro)}
        />
      }
    >
      <CamposPeriodo id={id} periodo={periodo} />
      <div className="grid gap-2">
        <Label htmlFor={`${id}-tipo`}>Tipo de serviço</Label>
        <ComboboxLista
          id={`${id}-tipo`}
          opcoes={OPCOES_TIPO_SERVICO}
          value={tipo}
          onChange={setTipo}
          placeholderBusca="Buscar tipo..."
          vazio="Nenhum tipo encontrado."
        />
      </div>
      <SelectLoja id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
    </CartaoRelatorio>
  );
}
