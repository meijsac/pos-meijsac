import ExcelJS from "exceljs"
import { NextResponse } from "next/server"

const COLUMNAS = [
  "Codigo",
  "Codigo Auxiliar",
  "Nombre",
  "Detalle",
  "Tipo Producto",
  "Tipo Iva",
  "Precio 1",
  "Precio 2",
  "Precio 3",
  "Stock",
  "Costo",
  "Codigo_Impuesto",
  "Tarifa_IVA_Porcentaje",
  "Unidad_Medida",
  "Descuento",
  "Valor_ICE",
  "Valor_IRBPNR",
]

export async function GET() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Productos")
  ws.addRow(COLUMNAS)
  ws.getRow(1).font = { bold: true }
  ws.addRow([
    "PROD-001",
    "7501031311",
    "COCA COLA 500ML",
    "Bebida",
    1,
    4,
    1.2,
    1.1,
    1,
    100,
    0.85,
    2,
    15,
    "UNIDAD",
    0,
    0,
    0,
  ])
  ;[18, 18, 32, 28, 16, 12, 12, 12, 12, 12, 12, 18, 22, 16, 12, 12, 16].forEach((wch, i) => { ws.getColumn(i + 1).width = wch })
  for (let col = 1; col <= COLUMNAS.length; col++) {
    for (let row = 1; row <= 500; row++) {
      const cell = ws.getCell(row, col)
      cell.protection = { locked: col === 12 && row > 1 }
    }
  }
  for (let row = 3; row <= 500; row++) ws.getCell(row, 12).value = 2
  ws.getCell("E1").note = "Solo 1 = Bien o 2 = Servicio. Ver hoja GUÍA SRI."
  ws.getCell("F1").note = "Solo 0, 2, 3, 4, 5, 6, 7 u 8. Ver hoja GUÍA SRI."
  ws.getCell("L1").note = "Siempre 2 (IVA). El sistema lo fija. No se edita."
  ws.dataValidations.add("E2:E500", {
    type: "list",
    allowBlank: true,
    formulae: ['"1,2"'],
    showErrorMessage: true,
    errorTitle: "Tipo Producto",
    error: "Tipo Producto debe ser 1 o 2",
  })
  ws.dataValidations.add("F2:F500", {
    type: "list",
    allowBlank: true,
    formulae: ['"0,2,3,4,5,6,7,8"'],
    showErrorMessage: true,
    errorTitle: "Tipo Iva",
    error: "Tipo Iva debe ser 0, 2, 3, 4, 5, 6, 7 u 8",
  })
  await ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    insertRows: true,
  })

  const guia = wb.addWorksheet("GUÍA SRI")
  guia.columns = [{ width: 28 }, { width: 88 }]
  const lineas: [string, string][] = [
    ["Campo", "Qué significa"],
    ["Tipo Producto", "1 = Bien. 2 = Servicio. No pongas el nombre del rubro (Coro, Clase, etc.). Ese dato va en Nombre."],
    ["Tipo Iva 0", "IVA 0%. El producto sí grava IVA, pero la tarifa es cero. Tarifa_IVA_Porcentaje = 0."],
    ["Tipo Iva 2", "IVA 12% (histórico). Tarifa_IVA_Porcentaje = 12."],
    ["Tipo Iva 3", "IVA 14% (histórico). Tarifa_IVA_Porcentaje = 14."],
    ["Tipo Iva 4", "IVA 15% vigente. Tarifa_IVA_Porcentaje = 15."],
    ["Tipo Iva 5", "IVA 5%. Tarifa_IVA_Porcentaje = 5."],
    ["Tipo Iva 6", "No objeto de IVA. No es tarifa 0%. Tarifa_IVA_Porcentaje = 0."],
    ["Tipo Iva 7", "Exento de IVA. No es lo mismo que 0: el código 0 es tarifa cero y el código 7 es exento. Tarifa_IVA_Porcentaje = 0."],
    ["Tipo Iva 8", "IVA diferenciado. Escribe en Tarifa_IVA_Porcentaje el porcentaje que corresponde."],
    ["Codigo_Impuesto", "Siempre 2, porque 2 es IVA. Va fijo y bloqueado. No lo cambies."],
    ["Precio 1, Precio 2, Precio 3", "Los tres precios son SIN IVA. Precio 1 es obligatorio. Precio 2 y Precio 3 son opcionales."],
    ["Stock", "Existencia. No uses una segunda columna de stock."],
    ["Descuento", "0 si no aplica."],
    ["Valor_ICE", "0 si no aplica. Es el impuesto código 3."],
    ["Valor_IRBPNR", "0 si no aplica. Es el impuesto código 5 (plásticos)."],
    ["Unidad_Medida", "UNIDAD, KG, LITRO, METRO, CAJA u otra unidad del producto."],
    ["Id", "No va en la plantilla. El sistema lo genera solo."],
  ]
  lineas.forEach((linea) => guia.addRow(linea))
  guia.getRow(1).font = { bold: true }

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Plantilla_Migracion_Productos.xlsx"',
    },
  })
}
