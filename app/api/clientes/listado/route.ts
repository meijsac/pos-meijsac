import ExcelJS from "exceljs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { COLUMNAS_CLIENTE, codigoDesdeCliente, tipoDesdeCliente } from "@/lib/clientes-masivo"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() || ""
  const clientes = await prisma.cliente.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { razonSocial: "asc" },
  })
  const filtrados = clientes.filter((c) => {
    if (!q) return true
    return c.razonSocial.toLowerCase().includes(q) || c.identificacion.includes(q)
  })
  if (!filtrados.length) return NextResponse.json({ error: "No hay clientes para descargar" }, { status: 400 })

  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date())
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Clientes")
  ws.addRow([...COLUMNAS_CLIENTE])
  ws.getRow(1).font = { bold: true }
  for (const c of filtrados) {
    const row = ws.addRow([
      codigoDesdeCliente(c.tipoId, c.identificacion),
      tipoDesdeCliente(c.tipoId, c.identificacion),
      c.identificacion,
      c.razonSocial,
      c.email || "",
      c.telefono || "",
      c.direccion || "",
      c.ciudad || "",
      c.frecuente ? "SI" : "NO",
    ])
    row.eachCell((cell) => {
      cell.numFmt = "@"
    })
  }
  ;[28, 24, 22, 32, 28, 16, 28, 16, 24].forEach((ancho, i) => {
    ws.getColumn(i + 1).width = ancho
  })
  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="listado_clientes_meijisac_${fecha}.xlsx"`,
    },
  })
}
