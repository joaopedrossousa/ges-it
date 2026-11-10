import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** notFound() nas páginas de detalhe (id inexistente ou inválido). */
export default function NaoEncontrado() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <SearchXIcon className="size-10 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Registro não encontrado</h1>
        <p className="text-muted-foreground">
          O endereço pode estar errado ou o registro não existe mais.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/dispositivos">Dispositivos</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/colaboradores">Usuários</Link>
        </Button>
      </div>
    </div>
  );
}
