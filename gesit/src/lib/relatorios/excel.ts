import ExcelJS from "exceljs";

import { formatarDataHora, formatarMoeda, paraRelogioDePalmas } from "@/lib/format";

import { agrupar, contar, type Coluna, type MetaRelatorio, type Relatorio, type Valor } from "./tipos";

const AZUL = "FF084897";
const AZUL_ESCURO = "FF00225C";
const AZUL_CLARO = "FFEAF0F8";

const FORMATO_NUMERICO: Partial<Record<NonNullable<Coluna["tipo"]>, string>> = {
  data: "dd/mm/yyyy",
  dataHora: "dd/mm/yyyy hh:mm",
  numero: "#,##0",
  moeda: '"R$" #,##0.00',
};

/** Largura aproximada (em caracteres) que o valor ocupa na célula. */
function larguraDoValor(valor: Valor, coluna: Coluna) {
  if (valor instanceof Date) return coluna.tipo === "data" ? 10 : 16;
  if (coluna.tipo === "moeda" && typeof valor === "number") return formatarMoeda(valor).length;
  return String(valor ?? "").length;
}

/** Datas viram data de verdade no Excel, no relógio de Palmas. */
function valorDaCelula(valor: Valor) {
  return valor instanceof Date ? paraRelogioDePalmas(valor) : valor;
}

/** Uma aba com título, filtros, cabeçalho azul, filtro automático e datas reais. */
export async function gerarExcel(relatorio: Relatorio, meta: MetaRelatorio): Promise<Buffer> {
  const { colunas } = relatorio;
  const livro = new ExcelJS.Workbook();
  livro.creator = "GesIT";
  livro.created = meta.geradoEm;

  // Cabeçalho da tabela na linha 5; as de cima trazem título e contexto.
  const LINHA_CABECALHO = 5;
  const aba = livro.addWorksheet(relatorio.aba.slice(0, 31), {
    views: [{ state: "frozen", ySplit: LINHA_CABECALHO }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: relatorio.orientacao === "paisagem" ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  aba.getCell("A1").value = relatorio.titulo;
  aba.getCell("A1").font = { bold: true, size: 14, color: { argb: AZUL_ESCURO } };
  aba.getCell("A2").value = `Gerado em ${formatarDataHora(meta.geradoEm)} por ${meta.geradoPor}`;
  aba.getCell("A3").value = relatorio.filtros.map((f) => `${f.rotulo}: ${f.valor}`).join(" · ");
  for (const celula of ["A2", "A3"]) aba.getCell(celula).font = { color: { argb: "FF5F6C76" } };

  const cabecalho = aba.getRow(LINHA_CABECALHO);
  cabecalho.values = colunas.map((c) => c.titulo);
  cabecalho.height = 20;
  cabecalho.eachCell((celula) => {
    celula.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celula.alignment = { vertical: "middle" };
  });

  const larguras = colunas.map((c) => c.titulo.length + 3); // + seta do filtro
  const adicionar = (valores: Valor[], destaque?: boolean) => {
    const linha = aba.addRow(valores.map(valorDaCelula));
    valores.forEach((v, i) => {
      larguras[i] = Math.max(larguras[i], larguraDoValor(v, colunas[i]));
    });
    if (destaque) {
      linha.font = { bold: true };
      linha.eachCell((celula) => {
        celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } };
      });
    }
  };
  const valoresDa = (linha: Relatorio["linhas"][number]) => colunas.map((c) => linha[c.chave] ?? null);

  if (relatorio.agruparPor) {
    // Subtotal com o nome do grupo na coluna agrupada: o filtro por loja mantém o subtotal.
    const iGrupo = colunas.findIndex((c) => c.chave === relatorio.agruparPor);
    const iTexto = iGrupo === 0 ? 1 : 0;
    const grupos = agrupar(relatorio.linhas, relatorio.agruparPor);
    for (const grupo of grupos) {
      for (const linha of grupo.linhas) adicionar(valoresDa(linha));
      const subtotal: Valor[] = colunas.map(() => null);
      subtotal[iGrupo] = grupo.titulo;
      subtotal[iTexto] = `Subtotal: ${contar(grupo.linhas.length, "item", "itens")}`;
      adicionar(subtotal, true);
    }
    if (grupos.length) {
      const total: Valor[] = colunas.map(() => null);
      total[iTexto] = `Total geral: ${contar(relatorio.linhas.length, "item", "itens")}`;
      adicionar(total, true);
    }
  } else {
    for (const linha of relatorio.linhas) adicionar(valoresDa(linha));
  }

  if (relatorio.linhas.length === 0) {
    aba.getCell(LINHA_CABECALHO + 1, 1).value = relatorio.vazio;
  }

  colunas.forEach((c, i) => {
    const coluna = aba.getColumn(i + 1);
    coluna.width = Math.min(Math.max(larguras[i] + 2, 8), 60);
    const formato = c.tipo && FORMATO_NUMERICO[c.tipo];
    if (formato) coluna.numFmt = formato;
  });

  aba.autoFilter = {
    from: { row: LINHA_CABECALHO, column: 1 },
    to: { row: Math.max(aba.rowCount, LINHA_CABECALHO), column: colunas.length },
  };

  return Buffer.from(await livro.xlsx.writeBuffer());
}
