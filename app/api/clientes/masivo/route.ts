import ExcelJS from "exceljs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { datosGuardables, matrizDesdeCsv, revisarTabla, textoCelda } from "@/lib/clientes-masivo"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function matrizDelArchivo(file: File) {
  const nombre = file.name.toLowerCase()
  if (nombre.endsWith(".csv")) return matrizDesdeCsv(await file.text())
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(Buffer.from(await file.arrayBuffer()))
  const ws = wb.worksheets[0]
  if (!ws) return []
  const matriz: unknown[][] = []
  const ultima = Math.max(ws.actualRowCount || 0, ws.rowCount || 0)
  for (let r = 1; r <= ultima; r++) {
    const fila: unknown[] = []
    for (let c = 1; c <= 8; c++) fila.push(textoCelda(ws.getRow(r).getCell(c).value))
    matriz.push(fila)
  }
  return matriz
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const form = await req.formData()
  const file = form.get("archivo")
  const confirmar = String(form.get("confirmar") || "") === "1"
  if (!(file instanceof File)) return NextResponse.json({ error: "Sube un Excel o un CSV" }, { status: 400 })
  const nombre = file.name.toLowerCase()
  if (!nombre.endsWith(".xlsx") && !nombre.endsWith(".csv")) {
    return NextResponse.json({ error: "Solo se acepta .xlsx o .csv" }, { status: 400 })
  }

  let matriz: unknown[][] = []
  try {
    matriz = await matrizDelArchivo(file)
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 400 })
  }
  const revision = revisarTabla(matriz)
  if (revision.error) return NextResponse.json({ error: revision.error, filas: [] }, { status: 400 })
  const conError = revision.filas.filter((f) => f.errores.length)
  const vista = revision.filas.map((f) => ({
    numero: f.numero,
    tipo_identificacion: f.datos.tipo_identificacion,
    identificacion: f.datos.identificacion,
    nombre_razon_social: f.datos.nombre_razon_social,
    email: f.datos.email,
    telefono: f.datos.telefono,
    direccion: f.datos.direccion,
    ciudad: f.datos.ciudad,
    es_cliente_frecuente: f.datos.es_cliente_frecuente,
    errores: f.errores,
  }))
  if (conError.length || !confirmar) {
    return NextResponse.json({
      ok: conError.length === 0,
      total: revision.filas.length,
      errores: conError.length,
      mensaje: conError.length ? `Hay ${conError.length} filas con error, corrígelas` : "",
      filas: vista,
    }, { status: conError.length && confirmar ? 400 : 200 })
  }

  const empresaId = sesion.empresa.id
  const ids = revision.filas.map((f) => f.datos.identificacion)
  let nuevos = 0
  let actualizados = 0
  await prisma.$transaction(async (tx) => {
    const ya = await tx.cliente.findMany({
      where: { empresaId, identificacion: { in: ids } },
      select: { identificacion: true },
    })
    const existentes = new Set(ya.map((c) => c.identificacion))
    for (const fila of revision.filas) {
      const data = datosGuardables(fila.datos)
      if (existentes.has(data.identificacion)) {
        await tx.cliente.update({
          where: { identificacion_empresaId: { identificacion: data.identificacion, empresaId } },
          data,
        })
        actualizados++
      } else {
        await tx.cliente.create({
          data: { ...data, empresaId, provincia: "PICHINCHA" },
        })
        nuevos++
      }
    }
  }, { timeout: 120000, maxWait: 15000 })

  const total = nuevos + actualizados
  return NextResponse.json({
    ok: true,
    total,
    nuevos,
    actualizados,
    mensaje: `Se cargaron ${total} clientes correctamente`,
    detalle: `${nuevos} nuevos, ${actualizados} actualizados`,
  })
}
