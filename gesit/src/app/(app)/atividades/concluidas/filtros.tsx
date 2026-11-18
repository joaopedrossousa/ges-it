"use client";

import { XIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { CampoBusca } from "@/components/campo-busca";
import { ComboboxLista } from "@/components/combobox-lista";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS, useFiltrosUrl } from "@/hooks/use-filtros-url";
import { SEM_RESPONSAVEL, nomeUsuario, type UsuarioSistema } from "@/lib/atividades";
import { REGEX_MES, formatarMes, mesesAoRedor } from "@/lib/financeiro";
import { TODOS_OS_MESES } from "@/lib/filtros-concluidas";

/**
 * Filtros da tela Concluídas, na URL: mês da conclusão (padrão: o atual, que
 * não vai para a URL; "Todos os meses" = ?mes=tudo), responsável e busca.
 */
export function FiltrosConcluidas({
  mesAtual,
  usuarios,
}: {
  /** "AAAA-MM" em Palmas, calculado no servidor. */
  mesAtual: string;
  usuarios: UsuarioSistema[];
}) {
  const { valor, atualizar, isPending } = useFiltrosUrl();
  const router = useRouter();
  const pathname = usePathname();
  const lido = valor("mes", mesAtual);
  const mes = lido === TODOS_OS_MESES || REGEX_MES.test(lido) ? lido : mesAtual;
  const q = valor("q", "");
  const responsavel = valor("responsavel");

  // Os últimos 24 meses (conclusão não é futura) e o escolhido, se for mais antigo.
  const meses = mesesAoRedor(mesAtual, 24, 0).reverse();
  if (mes !== TODOS_OS_MESES && !meses.includes(mes)) meses.push(mes);

  const opcoesUsuarios = [
    { value: TODOS, label: "Todos os responsáveis" },
    { value: SEM_RESPONSAVEL, label: "Sem responsável" },
    ...usuarios.map((u) => ({ value: u.id, label: nomeUsuario(u), descricao: u.email })),
  ];
  const filtrando = mes !== mesAtual || Boolean(q) || responsavel !== TODOS;

  // Tudo de uma vez (mês atual, todos os responsáveis, sem busca).
  const limpar = () => router.replace(pathname, { scroll: false });

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center" aria-busy={isPending || undefined}>
      {/* key: "Limpar filtros" também limpa o texto digitado. */}
      <CampoBusca
        key={q ? "busca" : "busca-vazia"}
        valorInicial={q}
        placeholder="Buscar no título"
        onBuscar={(v) => atualizar("q", v)}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
        <Select value={mes} onValueChange={(v) => atualizar("mes", v === mesAtual ? "" : v)}>
          {/* Cabe "Novembro de 2026 (atual)" inteiro. */}
          <SelectTrigger className="w-full lg:w-64" aria-label="Mês da conclusão">
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
        <ComboboxLista
          opcoes={opcoesUsuarios}
          value={responsavel}
          onChange={(v) => atualizar("responsavel", v)}
          ariaLabel="Filtrar por responsável"
          placeholderBusca="Buscar usuário..."
          vazio="Nenhum usuário encontrado."
          className="lg:w-56"
        />
      </div>
      {filtrando && (
        <Button variant="ghost" onClick={limpar} className="lg:ml-auto">
          <XIcon />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
