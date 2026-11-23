import { EsqueletoPagina } from "@/components/esqueleto-pagina";

/** Dashboard ("/") e qualquer tela sem loading.tsx próprio. */
export default function Loading() {
  return <EsqueletoPagina variante="painel" />;
}
