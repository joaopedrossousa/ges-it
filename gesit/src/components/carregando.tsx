import { cn } from "cn";

// Sobre fundo azul (botão primário) os pontos azuis assumem a cor do texto.
const AZUL = "bg-brand-blue in-data-[variant=default]:bg-current";
const PONTOS = [AZUL, "bg-brand-green", AZUL] as const;

/**
 * Indicador de carregamento da marca: três pontos pulsando (azul, verde, azul).
 * `rotulo` é lido por leitores de tela; passe `decorativo` quando o texto ao
 * lado (ex.: "Salvando...") já descreve o estado.
 */
export function Carregando({
  rotulo = "Carregando...",
  decorativo = false,
  tamanho = "md",
  className,
}: {
  rotulo?: string;
  decorativo?: boolean;
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      role={decorativo ? undefined : "status"}
      aria-label={decorativo ? undefined : rotulo}
      aria-hidden={decorativo || undefined}
      className={cn(
        "inline-flex items-center",
        tamanho === "sm" && "gap-0.5",
        tamanho === "md" && "gap-1",
        tamanho === "lg" && "gap-1.5",
        className,
      )}
    >
      {PONTOS.map((cor, i) => (
        <span
          key={i}
          className={cn(
            "animate-carregando-ponto rounded-full",
            cor,
            tamanho === "sm" && "size-1.5",
            tamanho === "md" && "size-2",
            tamanho === "lg" && "size-3",
          )}
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}

/** Carregamento de página inteira (usado nos loading.tsx). */
export function CarregandoPagina() {
  return (
    <div className="flex min-h-48 flex-1 items-center justify-center py-12">
      <Carregando tamanho="lg" />
    </div>
  );
}
