import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

function ventaValida(estado: string) {
  const e = estado.toUpperCase()
  if (e.includes("ANUL") || e.includes("BORRADOR")) return false
  return e === "AUTORIZADO" || e === "EMITIDA" || e.includes("AUTORIZ")
}

function pendiente(estadoPago: string | null) {
  const e = String(estadoPago || "").toUpperCase()
  if (!e || e === "PAGADO") return false
  return e.includes("PENDIENTE") || e.includes("CREDITO") || e.includes("CRÉDITO")
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const filas = await prisma.facturaEmitida.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { createdAt: "asc" },
  })
  const ahora = new Date()
  const ventas = filas.filter((f) => ventaValida(f.estado)).map((f) => {
    const total = Number((f.payload as any)?.totales?.total || 0)
    return { fecha: f.createdAt, total: Number.isFinite(total) ? total : 0, estadoPago: f.estadoPago }
  })
  const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const hoy = ventas.filter((v) => mismoDia(v.fecha, ahora)).reduce((s, v) => s + v.total, 0)
  const mes = ventas.filter((v) => v.fecha.getFullYear() === ahora.getFullYear() && v.fecha.getMonth() === ahora.getMonth()).reduce((s, v) => s + v.total, 0)
  const cxc = ventas.filter((v) => pendiente(v.estadoPago)).reduce((s, v) => s + v.total, 0)
  const enRango = (desde: Date) => ventas.filter((v) => v.fecha >= desde && v.fecha <= ahora)
  const inicioDia = new Date(ahora); inicioDia.setHours(0, 0, 0, 0)
  const inicioSemana = new Date(inicioDia); inicioSemana.setDate(inicioDia.getDate() - 6)
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1)
  const serie = (desde: Date, pasos: number, salto: (d: Date) => void) => {
    const valores: number[] = []
    const cursor = new Date(desde)
    for (let i = 0; i < pasos; i++) {
      const fin = new Date(cursor)
      salto(fin)
      valores.push(ventas.filter((v) => v.fecha >= cursor && v.fecha < fin).reduce((s, v) => s + v.total, 0))
      cursor.setTime(fin.getTime())
    }
    return valores
  }
  const metricas = (lista: { total: number }[]) => {
    const suma = lista.reduce((s, v) => s + v.total, 0)
    return {
      ventas: suma,
      pedidos: lista.length,
      carrito: lista.length ? suma / lista.length : 0,
      visitas: 0,
      tasa: 0,
      beneficio: 0,
    }
  }
  return NextResponse.json({
    ventasHoy: hoy,
    ventasMes: mes,
    cxc,
    ingresosMes: mes,
    egresosMes: 0,
    liquidez: mes > 0 ? (mes - 0) / mes : null,
    series: {
      dia: serie(inicioDia, 12, (d) => d.setHours(d.getHours() + 2)),
      semana: serie(inicioSemana, 7, (d) => d.setDate(d.getDate() + 1)),
      mes: serie(inicioMes, 4, (d) => d.setDate(d.getDate() + 7)),
      año: serie(inicioAnio, 12, (d) => d.setMonth(d.getMonth() + 1)),
    },
    metricas: {
      dia: metricas(enRango(inicioDia)),
      semana: metricas(enRango(inicioSemana)),
      mes: metricas(enRango(inicioMes)),
      año: metricas(enRango(inicioAnio)),
    },
  })
}
