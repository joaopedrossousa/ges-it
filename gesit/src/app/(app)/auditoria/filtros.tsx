"use client";

import { XIcon } from "lucide-react";

import { Carregando } from "@/components/carregando";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODOS, useFiltrosUrl } from "@/hooks/use-filtros-url";
import {
  ACAO_LABEL,
  ACOES_AUDITORIA,
  TABELAS_AUDITORIA,
  TIPO_REGISTRO_LABEL,
} from "@/lib/auditoria";

export type UsuarioOpcao = { id: string; email: string };

export function Filtros({ usuarios }: { usuarios: UsuarioOpcao[] }) {
  const { valor, atualizar, isPending } = useFiltrosUrl();
  const de = valor("de", "");
  const ate = valor("ate", "");
  const registro = valor("registro", "");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:flex lg:items-end">
        <div className="grid gap-1">
          <Label htmlFor="aud-de" className="text-xs text-muted-foreground">
            De
          </Label>
          <Input
            id="aud-de"
            type="date"
            className="lg:w-40"
            value={de}
            max={ate || undefined}
            onChange={(e) => atualizar("de", e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="aud-ate" className="text-xs text-muted-foreground">
            Até
          </Label>
          <Input
            id="aud-ate"
            type="date"
            className="lg:w-40"
            value={ate}
            min={de || undefined}
            onChange={(e) => atualizar("ate", e.target.value)}
          />
        </div>

        <Select value={valor("usuario")} onValueChange={(v) => atualizar("usuario", v)}>
          <SelectTrigger className="w-full lg:w-60" aria-label="Filtrar por usuário que fez a alteração">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os usuários</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={valor("tipo")} onValueChange={(v) => atualizar("tipo", v)}>
          <SelectTrigger className="w-full lg:w-44" aria-label="Filtrar por tipo de registro">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os registros</SelectItem>
            {TABELAS_AUDITORIA.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_REGISTRO_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={valor("acao")} onValueChange={(v) => atualizar("acao", v)}>
          <SelectTrigger className="w-full lg:w-40" aria-label="Filtrar por ação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as ações</SelectItem>
            {ACOES_AUDITORIA.map((a) => (
              <SelectItem key={a} value={a}>
                {ACAO_LABEL[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isPending && <Carregando rotulo="Atualizando..." tamanho="sm" />}
      </div>

      {registro && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Mostrando o log de um registro específico.
          <Button variant="ghost" size="sm" onClick={() => atualizar("registro", "")}>
            <XIcon />
            Ver todos
          </Button>
        </p>
      )}
    </div>
  );
}
