import { cache } from "react";

import { identificadorDispositivo } from "@/lib/dispositivos";
import { createClient } from "@/lib/supabase/server";
import type { StatusDispositivo, TipoDispositivo } from "@/lib/types";

export type DispositivoOpcao = {
  id: string;
  tipo: TipoDispositivo;
  marca: string;
  modelo: string;
  /** IMEI 1 formatado (telefone) ou Serial Number. */
  identificador: string;
  /** Dígitos/serial para a busca. */
  busca: string;
  status: StatusDispositivo;
  /** Usuário atual, se houver vínculo aberto. */
  colaborador_id: string | null;
  colaborador_nome: string | null;
};

/** Dispositivos que podem ser vinculados/transferidos (disponível ou em uso). */
export const listarDispositivosVinculaveis = cache(
  async (): Promise<DispositivoOpcao[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vw_dispositivos")
      .select(
        "id, tipo, marca, modelo, serial_number, imei1, imei2, status, colaborador_id, colaborador_nome",
      )
      .in("status", ["disponivel", "em_uso"])
      .order("marca")
      .order("modelo");

    if (error) {
      console.error("Erro ao listar dispositivos vinculáveis:", error);
      return [];
    }

    // Colunas da view vêm anuláveis; descarta linhas incompletas.
    return data.flatMap((d) =>
      d.id && d.tipo && d.status && d.marca !== null && d.modelo !== null
        ? [
            {
              id: d.id,
              tipo: d.tipo,
              marca: d.marca,
              modelo: d.modelo,
              identificador: identificadorDispositivo(d),
              busca: [d.serial_number, d.imei1, d.imei2, d.colaborador_nome]
                .filter(Boolean)
                .join(" "),
              status: d.status,
              colaborador_id: d.colaborador_id,
              colaborador_nome: d.colaborador_nome,
            },
          ]
        : [],
    );
  },
);
