import { readFileSync } from "node:fs";
import path from "node:path";

import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/format";

import { agrupar, contar, type Coluna, type Linha, type MetaRelatorio, type Relatorio, type Valor } from "./tipos";

// Arquivos lidos do disco: incluídos no deploy por outputFileTracingIncludes (next.config.ts).
const RAIZ = process.cwd();
// Cópia reduzida (440 px): o pdfkit incorpora a imagem de novo em cada página.
const ARQUIVO_LOGO = path.join(RAIZ, "public/brand/logo-horizontal-pdf.png");
const PASTA_FONTES = path.join(RAIZ, "node_modules/@fontsource/roboto/files");

/** Data URI: o react-pdf guarda em cache imagens com src em texto (decodifica uma vez). */
let logo = "";

function preparar() {
  if (logo) return;
  Font.register({
    family: "Roboto",
    fonts: ([400, 500, 700] as const).map((peso) => ({
      src: path.join(PASTA_FONTES, `roboto-latin-${peso}-normal.woff`),
      fontWeight: peso,
    })),
  });
  // Sem hifenização automática (quebraria nomes e números de série).
  Font.registerHyphenationCallback((palavra) => [palavra]);
  logo = `data:image/png;base64,${readFileSync(ARQUIVO_LOGO).toString("base64")}`;
}

const COR = {
  azul: "#084897",
  azulEscuro: "#00225C",
  azulClaro: "#EAF0F8",
  zebra: "#F6F8FB",
  borda: "#DDE3EA",
  texto: "#1B2433",
  suave: "#5F6C76",
  verde: "#009B67",
};

// ---------------------------------------------------------------------------
// Medidas (pt). A paginação é manual e depende delas: ver `paginar`.
// ---------------------------------------------------------------------------

const FONTE = 8;
const ENTRELINHA = 1.25;
const PAD_CELULA = 3;
const MARGEM = { topo: 24, base: 36, lados: 28 };
/** Altura de cada tipo de item da tabela (uma linha de texto por célula). */
const ALTURA = {
  linha: FONTE * ENTRELINHA + 2 * PAD_CELULA + 0.5, // + borda inferior
  grupo: 6 + FONTE * ENTRELINHA + 2 * PAD_CELULA, // + margem superior
  subtotal: FONTE * ENTRELINHA + 2 * PAD_CELULA + 0.75,
  total: 8 + 9 * ENTRELINHA,
};
/** Cabeçalho da página (logo e título) e cabeçalho da tabela, com folga. */
const ALTURA_TOPO = 50 + ALTURA.linha;
/** Quadro de filtros da primeira página (até duas linhas). */
const ALTURA_FILTROS = 8 + 10 + 2 * FONTE * ENTRELINHA + 4;
const A4 = { curto: 595.28, longo: 841.89 };
/**
 * Folga por página: as alturas acima são estimativas. Com `wrap={false}`, o
 * que passar da página seria cortado, então sobra espaço em vez de faltar.
 */
const FOLGA = 24;

const s = StyleSheet.create({
  pagina: {
    fontFamily: "Roboto",
    fontSize: FONTE,
    lineHeight: ENTRELINHA,
    color: COR.texto,
    paddingTop: MARGEM.topo,
    paddingBottom: MARGEM.base,
    paddingHorizontal: MARGEM.lados,
  },
  cabecalho: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: COR.azul,
    marginBottom: 8,
  },
  // A imagem tem margens transparentes: margem negativa aproxima das bordas.
  logo: { width: 110, marginLeft: -8 },
  cabecalhoTexto: { alignItems: "flex-end", gap: 2 },
  titulo: { fontSize: 14, fontWeight: 700, color: COR.azulEscuro, lineHeight: 1.1 },
  meta: { fontSize: 7.5, color: COR.suave },
  filtros: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    marginBottom: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: COR.azulClaro,
    borderLeftWidth: 2,
    borderLeftColor: COR.verde,
    maxHeight: ALTURA_FILTROS - 8,
  },
  filtroRotulo: { fontWeight: 700, color: COR.azulEscuro },
  linhaCabecalho: { flexDirection: "row", backgroundColor: COR.azul, color: "#FFFFFF", fontWeight: 700 },
  linha: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COR.borda },
  zebra: { backgroundColor: COR.zebra },
  // Uma linha por célula, com reticências: altura previsível (o Excel traz o texto completo).
  celula: { paddingVertical: PAD_CELULA, paddingHorizontal: 4, maxLines: 1, textOverflow: "ellipsis" },
  grupo: {
    marginTop: 6,
    paddingVertical: PAD_CELULA,
    paddingHorizontal: 4,
    backgroundColor: COR.azulClaro,
    color: COR.azulEscuro,
    fontWeight: 700,
    maxLines: 1,
  },
  subtotal: {
    paddingVertical: PAD_CELULA,
    paddingHorizontal: 4,
    textAlign: "right",
    fontWeight: 500,
    color: COR.azulEscuro,
    borderTopWidth: 0.75,
    borderTopColor: COR.azul,
    maxLines: 1,
  },
  total: { marginTop: 8, textAlign: "right", fontWeight: 700, color: COR.azulEscuro, fontSize: 9 },
  vazio: { paddingVertical: 12, textAlign: "center", color: COR.suave },
  rodape: {
    position: "absolute",
    bottom: 16,
    left: MARGEM.lados,
    right: MARGEM.lados,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COR.suave,
  },
});

function texto(valor: Valor, coluna: Coluna): string {
  if (valor === null || valor === "") return "—";
  if (valor instanceof Date) return coluna.tipo === "data" ? formatarData(valor) : formatarDataHora(valor);
  if (typeof valor === "number") {
    return coluna.tipo === "moeda" ? formatarMoeda(valor) : valor.toLocaleString("pt-BR");
  }
  return valor;
}

function Celulas({ colunas, linha }: { colunas: Coluna[]; linha?: Linha }) {
  return colunas.map((c) => (
    <Text key={c.chave} style={[s.celula, { flex: c.peso ?? 1 }]}>
      {linha ? texto(linha[c.chave] ?? null, c) : c.titulo}
    </Text>
  ));
}

/** Tudo o que vai abaixo do cabeçalho da tabela, já achatado. */
type Item =
  | { tipo: "linha"; linha: Linha; zebra: boolean }
  | { tipo: "grupo"; titulo: string }
  | { tipo: "subtotal"; texto: string }
  | { tipo: "total"; texto: string };

function itensDoRelatorio(relatorio: Relatorio): Item[] {
  const { linhas, agruparPor } = relatorio;
  const linhaItem = (linha: Linha, i: number): Item => ({ tipo: "linha", linha, zebra: i % 2 === 1 });
  if (!agruparPor) {
    return [
      ...linhas.map(linhaItem),
      { tipo: "total", texto: contar(linhas.length, "registro", "registros") },
    ];
  }
  return [
    ...agrupar(linhas, agruparPor).flatMap((g): Item[] => [
      { tipo: "grupo", titulo: g.titulo },
      ...g.linhas.map(linhaItem),
      { tipo: "subtotal", texto: `Subtotal ${g.titulo}: ${contar(g.linhas.length, "item", "itens")}` },
    ]),
    { tipo: "total", texto: `Total geral: ${contar(linhas.length, "item", "itens")}` },
  ];
}

/**
 * Paginação manual por altura: um <Page> por bloco, sem quebra automática.
 * Deixar o react-pdf quebrar uma tabela longa custa tempo quadrático
 * (5.000 linhas: ~5 min); com páginas prontas e alturas fixas, é linear.
 */
function paginar(itens: Item[], orientacao: Relatorio["orientacao"]): Item[][] {
  const alturaPagina = orientacao === "paisagem" ? A4.curto : A4.longo;
  const util = alturaPagina - MARGEM.topo - MARGEM.base - ALTURA_TOPO - FOLGA;

  const paginas: Item[][] = [];
  let atual: Item[] = [];
  let livre = util - ALTURA_FILTROS;
  for (const item of itens) {
    if (ALTURA[item.tipo] > livre && atual.length) {
      // Título de grupo não fica sozinho no fim da página.
      const orfao = atual.at(-1)?.tipo === "grupo" ? atual.pop() : undefined;
      paginas.push(atual);
      atual = orfao ? [orfao] : [];
      livre = util - (orfao ? ALTURA.grupo : 0);
    }
    atual.push(item);
    livre -= ALTURA[item.tipo];
  }
  paginas.push(atual);
  return paginas;
}

function ItemTabela({ item, colunas }: { item: Item; colunas: Coluna[] }) {
  switch (item.tipo) {
    case "linha":
      return (
        <View style={item.zebra ? [s.linha, s.zebra] : s.linha}>
          <Celulas colunas={colunas} linha={item.linha} />
        </View>
      );
    case "grupo":
      return <Text style={s.grupo}>{item.titulo}</Text>;
    case "subtotal":
      return <Text style={s.subtotal}>{item.texto}</Text>;
    case "total":
      return <Text style={s.total}>{item.texto}</Text>;
  }
}

function DocumentoRelatorio({ relatorio, meta }: { relatorio: Relatorio; meta: MetaRelatorio }) {
  const { agruparPor } = relatorio;
  const colunas = relatorio.colunasPdf ?? relatorio.colunas;
  // No agrupamento, a coluna do grupo vira o título do bloco.
  const colunasTabela = agruparPor ? colunas.filter((c) => c.chave !== agruparPor) : colunas;
  const paginas = relatorio.linhas.length
    ? paginar(itensDoRelatorio(relatorio), relatorio.orientacao)
    : [[]];
  const gerado = `Gerado em ${formatarDataHora(meta.geradoEm)} por ${meta.geradoPor}`;

  return (
    <Document title={relatorio.titulo} author={meta.geradoPor} creator="GesIT" producer="GesIT" language="pt-BR">
      {paginas.map((itens, i) => (
        <Page
          key={i}
          size="A4"
          orientation={relatorio.orientacao === "paisagem" ? "landscape" : "portrait"}
          style={s.pagina}
          wrap={false}
        >
          <View style={s.cabecalho}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt */}
            <Image style={s.logo} src={logo} />
            <View style={s.cabecalhoTexto}>
              <Text style={s.titulo}>{relatorio.titulo}</Text>
              <Text style={s.meta}>{gerado}</Text>
            </View>
          </View>

          {i === 0 && (
            <View style={s.filtros}>
              {relatorio.filtros.map((f) => (
                <Text key={f.rotulo}>
                  <Text style={s.filtroRotulo}>{f.rotulo}: </Text>
                  {f.valor}
                </Text>
              ))}
            </View>
          )}

          <View style={s.linhaCabecalho}>
            <Celulas colunas={colunasTabela} />
          </View>

          {relatorio.linhas.length === 0 ? (
            <Text style={s.vazio}>{relatorio.vazio}</Text>
          ) : (
            itens.map((item, j) => <ItemTabela key={j} item={item} colunas={colunasTabela} />)
          )}

          {/* Total de páginas conhecido de antemão: sem `render`, que refaz o layout de cada página. */}
          <View style={s.rodape}>
            <Text>GesIT · Produtécnica Agro · {relatorio.titulo}</Text>
            <Text>
              Página {i + 1} de {paginas.length}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}

export async function gerarPdf(relatorio: Relatorio, meta: MetaRelatorio): Promise<Buffer> {
  preparar();
  return renderToBuffer(<DocumentoRelatorio relatorio={relatorio} meta={meta} />);
}
