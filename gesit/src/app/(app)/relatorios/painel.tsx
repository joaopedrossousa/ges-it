"use client";

import {
  ArchiveXIcon,
  CalendarRangeIcon,
  CircleCheckBigIcon,
  FileWarningIcon,
  NetworkIcon,
  StoreIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import { useId, useState } from "react";

import { CampoData } from "@/components/campo-data";
import { CartaoRelatorio } from "@/components/cartao-relatorio";
import { ComboboxLista } from "@/components/combobox-lista";
import { ExportarBotoes } from "@/components/exportar";
import { MensagemErro } from "@/components/mensagem-erro";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS } from "@/hooks/use-filtros-url";
import {
  PRIORIDADE_LABEL,
  SEM_RESPONSAVEL,
  nomeUsuario,
  type CategoriaKanban,
  type UsuarioSistema,
} from "@/lib/atividades";
import { OPCOES_SITUACAO_COLABORADOR, SITUACAO_PADRAO } from "@/lib/colaboradores";
import { formatarMes, mesesAoRedor } from "@/lib/financeiro";
import { TODOS_OS_MESES } from "@/lib/filtros-concluidas";
import type { LojaOpcao } from "@/lib/lojas";
import { opcoesLojas } from "@/lib/opcoes-lojas";
import {
  MOTIVOS_BAIXA,
  MOTIVO_BAIXA_LABEL,
  PRIORIDADES_ATIVIDADE,
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

type OpcoesAtividades = {
  usuarios: UsuarioSistema[];
  colunas: { id: string; nome: string; arquivada: boolean }[];
  categorias: CategoriaKanban[];
};

/** "todos" (sem filtro) vira undefined na query string. */
const filtro = (valor: string) => (valor === TODOS ? undefined : valor);

export function PainelRelatorios({
  lojas,
  periodoPadrao,
  mesAtual,
  atividades,
}: Props & {
  /** "AAAA-MM" em Palmas, calculado no servidor. */
  mesAtual: string;
  atividades: OpcoesAtividades;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PorLoja lojas={lojas} />
      <Infraestrutura lojas={lojas} />
      <Movimentacoes periodoPadrao={periodoPadrao} />
      <SemTermo lojas={lojas} />
      <Colaboradores lojas={lojas} />
      <Servicos lojas={lojas} periodoPadrao={periodoPadrao} />
      <Baixas lojas={lojas} periodoPadrao={periodoPadrao} />
      <AtividadesConcluidas periodoPadrao={periodoPadrao} mesAtual={mesAtual} opcoes={atividades} />
    </div>
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
      titulo="Dispositivos por Loja"
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
            {TIPOS_VINCULAVEIS.map((t) => (
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

/** Itens de infraestrutura não têm vínculo: fora do filtro de "Dispositivos por Loja". */
const TIPOS_VINCULAVEIS = TIPOS_DISPOSITIVO.filter((t) => t !== "infraestrutura");

function Infraestrutura({ lojas }: { lojas: LojaOpcao[] }) {
  const id = useId();
  const [loja, setLoja] = useState(TODOS);

  return (
    <CartaoRelatorio
      icone={NetworkIcon}
      titulo="Infraestrutura por Filial"
      descricao="Access points, switches, firewalls e demais itens de cada filial, com subtotal por filial. Sem os baixados."
      rodape={
        <ExportarBotoes relatorio="infraestrutura-por-filial" params={{ loja: filtro(loja) }} />
      }
    >
      <SelectLoja id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
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
      titulo="Movimentações por Período"
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
      titulo="Vínculos sem Termo"
      descricao="Vínculos em aberto sem termo de responsabilidade, do mais antigo para o mais novo."
      rodape={<ExportarBotoes relatorio="vinculos-sem-termo" params={{ loja: filtro(loja) }} />}
    >
      <SelectLoja id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
    </CartaoRelatorio>
  );
}

function Colaboradores({ lojas }: { lojas: LojaOpcao[] }) {
  const id = useId();
  const [situacao, setSituacao] = useState<string>(SITUACAO_PADRAO);
  const [loja, setLoja] = useState(TODOS);

  return (
    <CartaoRelatorio
      icone={UsersIcon}
      titulo="Colaboradores"
      descricao="Colaboradores com filial, cargo, contato, dados pendentes e quantidade de dispositivos em uso."
      rodape={
        <ExportarBotoes relatorio="colaboradores" params={{ situacao, loja: filtro(loja) }} />
      }
    >
      <div className="grid gap-2">
        <Label htmlFor={`${id}-situacao`}>Situação</Label>
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger id={`${id}-situacao`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCOES_SITUACAO_COLABORADOR.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SelectLoja id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
      <p className="text-xs text-muted-foreground">
        Dados pendentes: colaboradores ativos sem CPF ou sem e-mail. O cargo em branco aparece na coluna, só como informação.
      </p>
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
      titulo="Serviços por Período"
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

function Baixas({ lojas, periodoPadrao }: Props) {
  const id = useId();
  const periodo = usePeriodo(periodoPadrao);
  const [motivo, setMotivo] = useState(TODOS);
  const [loja, setLoja] = useState(TODOS);

  return (
    <CartaoRelatorio
      icone={ArchiveXIcon}
      titulo="Baixas por Período"
      descricao="Dispositivos baixados, com motivo, informações e anexos. A filial é a de estoque do dispositivo."
      rodape={
        <ExportarBotoes
          relatorio="baixas"
          params={{
            de: periodo.de,
            ate: periodo.ate,
            motivo: filtro(motivo),
            loja: filtro(loja),
          }}
          desabilitado={Boolean(periodo.erro)}
        />
      }
    >
      <CamposPeriodo id={id} periodo={periodo} />
      <div className="grid gap-2">
        <Label htmlFor={`${id}-motivo`}>Motivo</Label>
        <Select value={motivo} onValueChange={setMotivo}>
          <SelectTrigger id={`${id}-motivo`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os motivos</SelectItem>
            {MOTIVOS_BAIXA.map((m) => (
              <SelectItem key={m} value={m}>
                {MOTIVO_BAIXA_LABEL[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SelectLoja id={`${id}-loja`} lojas={lojas} valor={loja} onChange={setLoja} />
    </CartaoRelatorio>
  );
}

const PERIODO_MES = "mes";
const PERIODO_INTERVALO = "intervalo";

/** Atividades > Concluídas: período por mês (ou todos) ou por intervalo de datas da conclusão. */
function AtividadesConcluidas({
  periodoPadrao,
  mesAtual,
  opcoes,
}: {
  periodoPadrao: Props["periodoPadrao"];
  mesAtual: string;
  opcoes: OpcoesAtividades;
}) {
  const id = useId();
  const [tipoPeriodo, setTipoPeriodo] = useState(PERIODO_MES);
  const [mes, setMes] = useState(mesAtual);
  const periodo = usePeriodo(periodoPadrao);
  const [responsavel, setResponsavel] = useState(TODOS);
  const [coluna, setColuna] = useState(TODOS);
  const [categoria, setCategoria] = useState(TODOS);
  const [prioridade, setPrioridade] = useState(TODOS);

  const porMes = tipoPeriodo === PERIODO_MES;
  // Os últimos 24 meses (conclusão não é futura), do mais recente ao mais antigo.
  const meses = mesesAoRedor(mesAtual, 24, 0).reverse();

  const opcoesResponsavel = [
    { value: TODOS, label: "Todos os responsáveis" },
    { value: SEM_RESPONSAVEL, label: "Sem responsável" },
    ...opcoes.usuarios.map((u) => ({ value: u.id, label: nomeUsuario(u), descricao: u.email })),
  ];
  const opcoesColuna = [
    { value: TODOS, label: "Todas as colunas" },
    ...opcoes.colunas.map((c) => ({
      value: c.id,
      label: c.arquivada ? `${c.nome} (arquivada)` : c.nome,
    })),
  ];
  const opcoesCategoria = [
    { value: TODOS, label: "Todas as categorias" },
    ...opcoes.categorias.map((c) => ({
      value: c.id,
      label: c.ativa ? c.nome : `${c.nome} (inativa)`,
    })),
  ];

  return (
    <CartaoRelatorio
      icone={CircleCheckBigIcon}
      titulo="Atividades Concluídas"
      descricao="Atividades do quadro concluídas no período, com responsável, prioridade e quem concluiu. Resumo por responsável e por prioridade."
      rodape={
        <ExportarBotoes
          relatorio="atividades-concluidas"
          params={{
            ...(porMes ? { mes } : { de: periodo.de, ate: periodo.ate }),
            responsavel: filtro(responsavel),
            coluna: filtro(coluna),
            categoria: filtro(categoria),
            prioridade: filtro(prioridade),
          }}
          desabilitado={!porMes && Boolean(periodo.erro)}
        />
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-tipo-periodo`}>Período da conclusão</Label>
          <Select value={tipoPeriodo} onValueChange={setTipoPeriodo}>
            <SelectTrigger id={`${id}-tipo-periodo`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PERIODO_MES}>Por mês</SelectItem>
              <SelectItem value={PERIODO_INTERVALO}>Intervalo de datas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {porMes && (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-mes`}>Mês</Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger id={`${id}-mes`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_OS_MESES}>Todos os meses</SelectItem>
                {meses.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatarMes(m)}
                    {m === mesAtual && " (atual)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {!porMes && <CamposPeriodo id={id} periodo={periodo} />}
      <div className="grid gap-2">
        <Label htmlFor={`${id}-responsavel`}>Responsável</Label>
        <ComboboxLista
          id={`${id}-responsavel`}
          opcoes={opcoesResponsavel}
          value={responsavel}
          onChange={setResponsavel}
          placeholderBusca="Buscar usuário..."
          vazio="Nenhum usuário encontrado."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-coluna`}>Coluna de origem</Label>
          <ComboboxLista
            id={`${id}-coluna`}
            opcoes={opcoesColuna}
            value={coluna}
            onChange={setColuna}
            placeholderBusca="Buscar coluna..."
            vazio="Nenhuma coluna encontrada."
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-categoria`}>Categoria</Label>
          <ComboboxLista
            id={`${id}-categoria`}
            opcoes={opcoesCategoria}
            value={categoria}
            onChange={setCategoria}
            placeholderBusca="Buscar categoria..."
            vazio="Nenhuma categoria encontrada."
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-prioridade`}>Prioridade</Label>
        <Select value={prioridade} onValueChange={setPrioridade}>
          <SelectTrigger id={`${id}-prioridade`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as prioridades</SelectItem>
            {PRIORIDADES_ATIVIDADE.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORIDADE_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">Padrão: mês atual. Horário de Palmas (TO).</p>
    </CartaoRelatorio>
  );
}
