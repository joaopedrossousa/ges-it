"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPCOES = [
  { valor: "light", rotulo: "Claro", icone: SunIcon },
  { valor: "dark", rotulo: "Escuro", icone: MoonIcon },
  { valor: "system", rotulo: "Automático (sistema)", icone: MonitorIcon },
] as const;

/**
 * Botão do cabeçalho (desktop e celular) que abre o menu de tema. O ícone
 * segue a classe .dark do <html> só por CSS, então não depende do estado do
 * React (sem divergência de hidratação); a opção marcada vem do next-themes,
 * lida só quando o menu abre.
 */
export function SeletorTema() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Tema da interface" title="Tema da interface">
          <SunIcon aria-hidden className="dark:hidden" />
          <MoonIcon aria-hidden className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          {OPCOES.map(({ valor, rotulo, icone: Icone }) => (
            <DropdownMenuRadioItem key={valor} value={valor}>
              <Icone aria-hidden />
              {rotulo}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
