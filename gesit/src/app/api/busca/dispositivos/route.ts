import { NextResponse, type NextRequest } from "next/server";

import { LIMITE_BUSCA, MINIMO_BUSCA, limparBusca, palavrasBusca } from "@/lib/busca";
import {
  STATUS_VINCULAVEIS,
  paraDispositivoOpcao,
  type DispositivoOpcao,
} from "@/lib/opcoes-vinculo";
import { createClient } from "@/lib/supabase/server";
import { somenteDigitos } from "@/lib/validators";

/**
 * GET /api/busca/dispositivos?q=<texto>
 * Combobox do diálogo de vincular: dispositivos disponíveis ou em uso.
 * Cada palavra precisa casar com marca, modelo, serial, IMEI ou usuário atual.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const palavras = palavrasBusca(q);
  if (limparBusca(q).length < MINIMO_BUSCA || palavras.length === 0) {
    return resposta([]);
  }

  const supabase = await createClient();
  let query = supabase
    .from("vw_dispositivos")
    .select(
      "id, tipo, marca, modelo, serial_number, imei1, status, colaborador_id, colaborador_nome",
    )
    .in("status", [...STATUS_VINCULAVEIS]);

  for (const p of palavras) {
    const filtros = [
      `marca.ilike.%${p}%`,
      `modelo.ilike.%${p}%`,
      `serial_number.ilike.%${p}%`,
      `colaborador_nome.ilike.%${p}%`,
    ];
    const digitos = somenteDigitos(p);
    if (digitos.length >= 3) {
      filtros.push(`imei1.like.%${digitos}%`, `imei2.like.%${digitos}%`);
    }
    query = query.or(filtros.join(","));
  }

  const { data, error } = await query
    .order("marca")
    .order("modelo")
    .order("id")
    .limit(LIMITE_BUSCA);

  if (error) {
    console.error("Erro na busca de dispositivos:", error);
    return NextResponse.json({ erro: "Não foi possível buscar." }, { status: 500 });
  }

  return resposta(data.flatMap((d) => paraDispositivoOpcao(d) ?? []));
}

function resposta(itens: DispositivoOpcao[]) {
  return NextResponse.json({ itens }, { headers: { "Cache-Control": "no-store" } });
}
