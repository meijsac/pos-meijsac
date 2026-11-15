import ExcelJS from "exceljs"
import { NextResponse } from "next/server"
import { EJEMPLOS_CLIENTE } from "@/lib/clientes-masivo"

export const dynamic = "force-dynamic"

const COLUMNAS_PLANTILLA = [
  "codigo_tipo_identificacion",
  "identificacion",
  "nombre_razon_social",
  "email",
  "telefono",
  "direccion",
  "ciudad",
  "es_cliente_frecuente",
] as const

export async function GET() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Clientes")
  ws.addRow([...COLUMNAS_PLANTILLA])
  ws.getRow(1).font = { bold: true }
  for (const fila of EJEMPLOS_CLIENTE) {
    const row = ws.addRow([fila[0], ...fila.slice(2)])
    row.eachCell((cell) => {
      cell.numFmt = "@"
    })
  }
  ;[28, 22, 32, 28, 16, 28, 16, 24].forEach((ancho, i) => {
    ws.getColumn(i + 1).width = ancho
    ws.getColumn(i + 1).numFmt = "@"
  })
  ws.dataValidations.add("A2:A2000", {
    type: "list",
    allowBlank: false,
    formulae: ['"04,05,06,07,08"'],
    showErrorMessage: true,
    errorTitle: "Código",
    error: "04 RUC, 05 CÉDULA, 06 PASAPORTE, 07 CONSUMIDOR FINAL, 08 IDENTIFICACIÓN DEL EXTERIOR",
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
