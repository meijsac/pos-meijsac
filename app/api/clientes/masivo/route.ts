import ExcelJS from "exceljs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { COLUMNAS_CLIENTE, datosGuardables, erroresDeFila, LOTE_CLIENTES, matrizDesdeCsv, revisarTabla, textoCelda, type FilaCliente } from "@/lib/clientes-masivo"

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
    for (let c = 1; c <= COLUMNAS_CLIENTE.length; c++) fila.push(textoCelda(ws.getRow(r).getCell(c).value))
    matriz.push(fila)
  }
  return matriz
}

function filaEntrada(cruda: Record<string, unknown>, numero: number): FilaCliente & { numero: number } {
  return {
    numero,
    codigo_tipo_identificacion: String(cruda.codigo_tipo_identificacion || ""),
    tipo_identificacion: String(cruda.tipo_identificacion || ""),
    identificacion: String(cruda.identificacion || ""),
    nombre_razon_social: String(cruda.nombre_razon_social || ""),
    email: String(cruda.email || ""),
    telefono: String(cruda.telefono || ""),
    direccion: String(cruda.direccion || ""),
    ciudad: String(cruda.ciudad || ""),
    es_cliente_frecuente: String(cruda.es_cliente_frecuente || ""),
  }
}

async function guardarLote(empresaId: string, filas: (FilaCliente & { numero: number })[]) {
  const fallos: { numero: number; motivo: string }[] = []
  const validas: (FilaCliente & { numero: number })[] = []
  for (const fila of filas) {
    const errores = erroresDeFila(fila)
    if (errores.length) fallos.push({ numero: fila.numero, motivo: errores.join(", ") })
    else validas.push(fila)
  }
  const ids = validas.map((f) => f.identificacion)
  const ya = ids.length
    ? await prisma.cliente.findMany({
        where: { empresaId, identificacion: { in: ids } },
        select: { identificacion: true },
      })
    : []
  const existentes = new Set(ya.map((c) => c.identificacion))
  let nuevos = 0
  let actualizados = 0
  for (const fila of validas) {
    const data = datosGuardables(fila)
    try {
      await prisma.cliente.upsert({
        where: { identificacion_empresaId: { identificacion: data.identificacion, empresaId } },
        update: data,
        create: { ...data, empresaId, provincia: "PICHINCHA" },
      })
      if (existentes.has(data.identificacion)) actualizados++
      else {
        nuevos++
        existentes.add(data.identificacion)
      }
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "no se pudo guardar"
      fallos.push({ numero: fila.numero, motivo })
    }
  }
  const total = nuevos + actualizados
  return { ok: fallos.length === 0, total, nuevos, actualizados, fallos }
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const tipo = req.headers.get("content-type") || ""
  if (tipo.includes("application/json")) {
    const body = await req.json().catch(() => null)
    const crudas = Array.isArray(body?.filas) ? body.filas : []
    if (!crudas.length) return NextResponse.json({ error: "No hay clientes en el lote" }, { status: 400 })
    if (crudas.length > LOTE_CLIENTES) return NextResponse.json({ error: "El lote máximo es 50" }, { status: 400 })
    const filas = crudas.map((fila: Record<string, unknown>, i: number) => filaEntrada(fila, Number(fila?.numero) || i + 1))
    try {
      const resultado = await guardarLote(sesion.empresa.id, filas)
      return NextResponse.json(resultado)
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "No se pudo guardar el lote"
      return NextResponse.json({ error: motivo, fallos: [] }, { status: 500 })
    }
  }
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
    codigo_tipo_identificacion: f.datos.codigo_tipo_identificacion,
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
  if (revision.filas.length > LOTE_CLIENTES) {
    return NextResponse.json({ error: "El lote máximo es 50" }, { status: 400 })
  }
  try {
    const resultado = await guardarLote(sesion.empresa.id, revision.filas.map((f) => ({ ...f.datos, numero: f.numero })))
    return NextResponse.json({
      ...resultado,
      mensaje: `Se cargaron ${resultado.total} clientes correctamente`,
      detalle: `${resultado.nuevos} nuevos, ${resultado.actualizados} actualizados`,
    })
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "No se pudo guardar el lote"
    return NextResponse.json({ error: motivo, fallos: [] }, { status: 500 })
  }
}
