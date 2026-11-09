import ExcelJS from "exceljs"
import { NextResponse } from "next/server"
import { COLUMNAS_CLIENTE, EJEMPLOS_CLIENTE } from "@/lib/clientes-masivo"

export const dynamic = "force-dynamic"

export async function GET() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Clientes")
  ws.addRow([...COLUMNAS_CLIENTE])
  ws.getRow(1).font = { bold: true }
  for (const fila of EJEMPLOS_CLIENTE) {
    const row = ws.addRow(fila)
    row.eachCell((cell) => {
      cell.numFmt = "@"
    })
  }
  ;[24, 22, 32, 28, 16, 28, 16, 24].forEach((ancho, i) => {
    ws.getColumn(i + 1).width = ancho
    ws.getColumn(i + 1).numFmt = "@"
  })
  ws.dataValidations.add("A2:A2000", {
    type: "list",
    allowBlank: false,
    formulae: ['"CEDULA,RUC,PASAPORTE,CONSUMIDOR FINAL"'],
    showErrorMessage: true,
    errorTitle: "Tipo",
    error: "Solo CEDULA, RUC, PASAPORTE o CONSUMIDOR FINAL",
  })
  ws.dataValidations.add("H2:H2000", {
    type: "list",
    allowBlank: false,
    formulae: ['"SI,NO"'],
    showErrorMessage: true,
    errorTitle: "Cliente frecuente",
    error: "Solo SI o NO",
  })
  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla_clientes_meijisac.xlsx"',
    },
  })
}
