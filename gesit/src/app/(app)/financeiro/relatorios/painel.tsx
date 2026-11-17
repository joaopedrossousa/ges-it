"use client";

import {
  CalendarRangeIcon,
  ClipboardListIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useId, useState } from "react";

import { CartaoRelatorio } from "@/components/cartao-relatorio";
import { ComboboxLista } from "@/components/combobox-lista";
import { ExportarBotoes } from "@/components/exportar";
import { MensagemErro } from "@/components/mensagem-erro";
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
import { TIPO_DESPESA_LABEL, formatarMes, mesesAoRedor } from "@/lib/financeiro";
import type { LojaOpcao } from "@/lib/lojas";
import { opcoesLojas } from "@/lib/opcoes-lojas";
import { TIPOS_DESPESA } from "@/lib/types";

type Props = {
  lojas: LojaOpcao[];
  /** Mês atual em Palmas ("AAAA-MM"), calculado no servidor. */
  mesAtual: string;
};

/** "todos" (sem filtro) vira undefined na query string. */
const filtro = (valor: string) => (valor === TODOS ? undefined : valor);

export function PainelRelatoriosFinanceiros({ lojas, mesAtual }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ControleMensal lojas={lojas} mesAtual={mesAtual} />
      <DespesasPeriodo lojas={lojas} mesAtual={mesAtual} />
      <DespesasFornecedor mesAtual={mesAtual} />
      <Pendencias lojas={lojas} />
    </div>
  );
}

function SelectMes({
  id,
  rotulo,
  mesAtual,
  valor,
  onChange,
}: {
  id: string;
  rotulo: string;
  mesAtual: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  // Três anos para trás e três meses à frente (contas lançadas antes).
  const meses = mesesAoRedor(mesAtual, 36, 3).reverse();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {meses.map((m) => (
            <SelectItem key={m} value={m}>
              {formatarMes(m)}
              {m === mesAtual && " (atual)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Meses De e Até ("AAAA-MM") e a validação "de ≤ até". */
function usePeriodo(mesAtual: string) {
  const [de, setDe] = useState(mesAtual);
  const [ate, setAte] = useState(mesAtual);
  const erro = de > ate ? "O mês inicial deve ser anterior ou igual ao final." : undefined;
  return { de, ate, setDe, setAte, erro };
}

function CamposPeriodo({
  id,
  mesAtual,
  periodo,
}: {
  id: string;
  mesAtual: string;
  periodo: ReturnType<typeof usePeriodo>;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SelectMes id={`${id}-de`} rotulo="De" mesAtual={mesAtual} valor={periodo.de} onChange={periodo.setDe} />
        <SelectMes id={`${id}-ate`} rotulo="Até" mesAtual={mesAtual} valor={periodo.ate} onChange={periodo.setAte} />
      </div>
      <MensagemErro id={`${id}-erro`} mensagem={periodo.erro} />
    </>
  );
}

function SelectTipo({ id, valor, onChange }: { id: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Tipo</Label>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os tipos</SelectItem>
          {TIPOS_DESPESA.map((t) => (
            <SelectItem key={t} value={t}>
              {TIPO_DESPESA_LABEL[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SelectFilial({
  id,
  lojas,
  valor,
  onChange,
}: {
  id: string;
  lojas: LojaOpcao[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Filial</Label>
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

function ControleMensal({ lojas, mesAtual }: Props) {
  const id = useId();
  const [mes, setMes] = useState(mesAtual);
  const [loja, setLoja] = useState(TODOS);

  return (
    <CartaoRelatorio
      icone={ClipboardListIcon}
      titulo="Controle Mensal"
      descricao="Igual à planilha: lançamentos da competência por tipo, com subtotais e totais (Total, Pago e Em Aberto)."
      rodape={
        <ExportarBotoes
          relatorio="financeiro-controle-mensal"
          params={{ mes, loja: filtro(loja) }}
        />
      }
    >
      <SelectMes id={`${id}-mes`} rotulo="Competência" mesAtual={mesAtual} valor={mes} onChange={setMes} />
      <SelectFilial id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
      <p className="text-xs text-muted-foreground">Cancelados aparecem na lista, fora dos totais.</p>
    </CartaoRelatorio>
  );
}

function DespesasPeriodo({ lojas, mesAtual }: Props) {
  const id = useId();
  const periodo = usePeriodo(mesAtual);
  const [tipo, setTipo] = useState(TODOS);
  const [loja, setLoja] = useState(TODOS);
  const [fornecedor, setFornecedor] = useState("");

  return (
    <CartaoRelatorio
      icone={CalendarRangeIcon}
      titulo="Despesas por Período"
      descricao="Lançamentos por mês de competência, com total por mês e por tipo. Sem os cancelados."
      rodape={
        <ExportarBotoes
          relatorio="financeiro-despesas-periodo"
          params={{
            de: periodo.de,
            ate: periodo.ate,
            tipo: filtro(tipo),
            loja: filtro(loja),
            fornecedor: fornecedor.trim() || undefined,
          }}
          desabilitado={Boolean(periodo.erro)}
        />
      }
    >
      <CamposPeriodo id={id} mesAtual={mesAtual} periodo={periodo} />
      <SelectTipo id={`${id}-tipo`} valor={tipo} onChange={setTipo} />
      <SelectFilial id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
      <div className="grid gap-2">
        <Label htmlFor={`${id}-fornecedor`}>Fornecedor (opcional)</Label>
        <Input
          id={`${id}-fornecedor`}
          value={fornecedor}
          onChange={(e) => setFornecedor(e.target.value)}
          maxLength={100}
          autoComplete="off"
          placeholder="Parte do nome, ex.: Claro"
        />
      </div>
    </CartaoRelatorio>
  );
}

function DespesasFornecedor({ mesAtual }: { mesAtual: string }) {
  const id = useId();
  const periodo = usePeriodo(mesAtual);
  const [tipo, setTipo] = useState(TODOS);

  return (
    <CartaoRelatorio
      icone={ReceiptTextIcon}
      titulo="Despesas por Fornecedor"
      descricao="Soma por fornecedor no período, com média mensal, quantidade de lançamentos, pago e em aberto."
      rodape={
        <ExportarBotoes
          relatorio="financeiro-despesas-fornecedor"
          params={{ de: periodo.de, ate: periodo.ate, tipo: filtro(tipo) }}
          desabilitado={Boolean(periodo.erro)}
        />
      }
    >
      <CamposPeriodo id={id} mesAtual={mesAtual} periodo={periodo} />
      <SelectTipo id={`${id}-tipo`} valor={tipo} onChange={setTipo} />
      <p className="text-xs text-muted-foreground">
        Média mensal: total dividido pelo número de meses do período.
      </p>
    </CartaoRelatorio>
  );
}

function Pendencias({ lojas }: { lojas: LojaOpcao[] }) {
  const id = useId();
  const [loja, setLoja] = useState(TODOS);
  const [tipo, setTipo] = useState(TODOS);

  return (
    <CartaoRelatorio
      icone={TriangleAlertIcon}
      titulo="Pendências"
      descricao="Vencidos em aberto e lançamentos aguardando aprovação, de qualquer competência."
      rodape={
        <ExportarBotoes
          relatorio="financeiro-pendencias"
          params={{ loja: filtro(loja), tipo: filtro(tipo) }}
        />
      }
    >
      <SelectFilial id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
      <SelectTipo id={`${id}-tipo`} valor={tipo} onChange={setTipo} />
      <p className="text-xs text-muted-foreground">
        Aguardando aprovação: aprovação Não OK ou, sem aprovação informada, na situação Solicitado
        Compras.
      </p>
    </CartaoRelatorio>
  );
}
