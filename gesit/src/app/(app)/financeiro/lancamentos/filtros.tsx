"use client";

import { CampoBusca } from "@/components/campo-busca";
import { Carregando } from "@/components/carregando";
import { ComboboxLista } from "@/components/combobox-lista";
import { SeletorMes } from "@/components/financeiro/seletor-mes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS, useFiltrosUrl } from "@/hooks/use-filtros-url";
import {
  SITUACAO_PAGAMENTO_LABEL,
  SITUACAO_VENCIMENTO_LABEL,
  SITUACOES_VENCIMENTO,
  TIPO_DESPESA_LABEL,
} from "@/lib/financeiro";
import type { LojaOpcao } from "@/lib/lojas";
import { opcoesLojas } from "@/lib/opcoes-lojas";
import { SITUACOES_PAGAMENTO, TIPOS_DESPESA } from "@/lib/types";

export function FiltrosLancamentos({ lojas, mesAtual }: { lojas: LojaOpcao[]; mesAtual: string }) {
  const { valor, atualizar, isPending } = useFiltrosUrl();

  return (
    <div className="space-y-2">
      <SeletorMes mesAtual={mesAtual} />

      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <CampoBusca
          valorInicial={valor("q", "")}
          placeholder="Buscar por descrição, identificador ou ID de aprovação"
          onBuscar={(q) => atualizar("q", q)}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:flex">
          <Select value={valor("tipo")} onValueChange={(v) => atualizar("tipo", v)}>
            <SelectTrigger className="w-full lg:w-48" aria-label="Filtrar por tipo">
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

          <Select value={valor("situacao")} onValueChange={(v) => atualizar("situacao", v)}>
            <SelectTrigger className="w-full lg:w-52" aria-label="Filtrar por situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as situações</SelectItem>
              {SITUACOES_PAGAMENTO.map((s) => (
                <SelectItem key={s} value={s}>
                  {SITUACAO_PAGAMENTO_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={valor("venc")} onValueChange={(v) => atualizar("venc", v)}>
            <SelectTrigger
              className="w-full lg:w-52"
              aria-label="Filtrar por situação do vencimento"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Vencimento: todos</SelectItem>
              {SITUACOES_VENCIMENTO.map((s) => (
                <SelectItem key={s} value={s}>
                  {SITUACAO_VENCIMENTO_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ComboboxLista
            opcoes={opcoesLojas(lojas, { todas: true })}
            value={valor("loja")}
            onChange={(v) => atualizar("loja", v)}
            ariaLabel="Filtrar pela filial"
            placeholderBusca="Buscar loja ou cidade..."
            vazio="Nenhuma loja encontrada."
            className="lg:w-52"
          />
        </div>

        {isPending && <Carregando rotulo="Atualizando..." tamanho="sm" />}
      </div>
    </div>
  );
}
