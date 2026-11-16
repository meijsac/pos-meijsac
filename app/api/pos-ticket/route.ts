import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { datosRegistroDe, usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puntoActivoFactura } from "@/lib/sri/punto-emision"

export const maxDuration = 30

const PAGOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "DINERO ELECTRONICO"] as const
const TECHO = 20000

function dinero(valor: number) {
  return Math.round(valor * 100) / 100
}

function inicioGuayaquil(modo: "dia" | "mes" | "ano") {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-")
  const [anio, mes, dia] = partes
  const fecha = modo === "ano" ? `${anio}-01-01` : modo === "mes" ? `${anio}-${mes}-01` : `${anio}-${mes}-${dia}`
  return new Date(`${fecha}T00:00:00-05:00`)
}

function puntoInterno(datos: unknown, ambiente: unknown) {
  const extra = datosRegistroDe(datos)
  const { punto } = puntoActivoFactura(extra.secuenciales, ambiente)
  return {
    estab: punto.estab || "001",
    pto: punto.pto || "001",
  }
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const punto = puntoInterno(sesion.empresa.datosRegistro, sesion.empresa.ambienteSri)
  const donde = { empresaId: sesion.empresa.id }
  const [hoyFilas, mes, ano, recientes] = await Promise.all([
    prisma.ticketInterno.groupBy({ by: ["pago"], where: { ...donde, createdAt: { gte: inicioGuayaquil("dia") } }, _sum: { total: true } }),
    prisma.ticketInterno.aggregate({ where: { ...donde, createdAt: { gte: inicioGuayaquil("mes") } }, _sum: { total: true } }),
    prisma.ticketInterno.aggregate({ where: { ...donde, createdAt: { gte: inicioGuayaquil("ano") } }, _sum: { total: true } }),
    prisma.ticketInterno.findMany({ where: donde, orderBy: { createdAt: "desc" }, take: 15 }),
  ])
  const hoy: Record<string, number> = {}
  for (const fila of hoyFilas) hoy[fila.pago] = dinero(fila._sum.total || 0)
  const anual = dinero(ano._sum.total || 0)
  return NextResponse.json({
    estab: punto.estab,
    pto: punto.pto,
    hoy,
    mes: dinero(mes._sum.total || 0),
    ano: anual,
    techo: TECHO,
    recientes,
    empresa: {
      ruc: sesion.empresa.ruc,
      razonSocial: sesion.empresa.razonSocial,
      nombreComercial: sesion.empresa.nombreComercial || sesion.empresa.nombre || "",
      direccion: sesion.empresa.direccion || "",
    },
  })
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const pago = String(body?.pago || "").toUpperCase()
  if (!PAGOS.includes(pago as (typeof PAGOS)[number])) return NextResponse.json({ error: "Elige efectivo, tarjeta, transferencia o dinero electrónico" }, { status: 400 })
  const lineas = Array.isArray(body?.lineas) ? body.lineas : []
  if (!lineas.length || lineas.length > 80) return NextResponse.json({ error: "El ticket no tiene productos" }, { status: 400 })
  const pedido = new Map<string, number>()
  for (const linea of lineas) {
    const id = String(linea?.productoId || "").trim()
    const cantidad = Number(linea?.cantidad)
    if (!id || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 9999) return NextResponse.json({ error: "Hay una cantidad inválida" }, { status: 400 })
    pedido.set(id, (pedido.get(id) || 0) + cantidad)
  }
  const productos = await prisma.producto.findMany({ where: { empresaId: sesion.empresa.id, id: { in: [...pedido.keys()] } } })
  if (productos.length !== pedido.size) return NextResponse.json({ error: "Hay un producto que no es de tu empresa" }, { status: 400 })
  const detalle: { codigo: string; nombre: string; cantidad: number; precio: number; total: number }[] = []
  const fisicos: { id: string; nombre: string; codigo: string; cantidad: number; costo: number }[] = []
  let total = 0
  for (const producto of productos) {
    const cantidad = pedido.get(producto.id) || 0
    const precio = dinero(Number(producto.precio) || 0)
    const subtotal = dinero(precio * cantidad)
    total = dinero(total + subtotal)
    detalle.push({ codigo: producto.codigo || "", nombre: producto.nombre, cantidad, precio, total: subtotal })
    const ficha = producto.ficha && typeof producto.ficha === "object" && !Array.isArray(producto.ficha) ? producto.ficha as Record<string, unknown> : {}
    const servicio = ficha.tipoItem === "SERVICIO" || ficha.manejaStock === false
    if (!servicio) fisicos.push({ id: producto.id, nombre: producto.nombre, codigo: producto.codigo || "", cantidad, costo: Number(producto.costo) || 0 })
  }
  for (const linea of fisicos) {
    const producto = productos.find((p) => p.id === linea.id)
    if (!producto || Number(producto.stock) < linea.cantidad) {
      return NextResponse.json({ error: `No hay stock de ${linea.nombre}` }, { status: 400 })
    }
  }
  const punto = puntoInterno(sesion.empresa.datosRegistro, sesion.empresa.ambienteSri)
  const clienteNombre = String(body?.clienteNombre || "").trim().slice(0, 180)
  const clienteIdentificacion = String(body?.clienteIdentificacion || "").trim().slice(0, 20)
  const notaFisica = String(body?.notaFisica || "").trim().slice(0, 40)
  let ultimoError = "No se pudo guardar el ticket"
  for (let intento = 0; intento < 3; intento++) {
    const maximo = await prisma.ticketInterno.aggregate({
      where: { empresaId: sesion.empresa.id, estab: punto.estab, pto: punto.pto },
      _max: { numero: true },
    })
    const numero = (maximo._max.numero || 0) + 1
    const creado = await prisma.ticketInterno.create({
      data: {
        empresaId: sesion.empresa.id,
        estab: punto.estab,
        pto: punto.pto,
        numero,
        clienteNombre,
        clienteIdentificacion,
        notaFisica,
        pago,
        total,
        detalle,
      },
    }).catch((e: { code?: string; message?: string }) => {
      ultimoError = e?.code === "P2002" ? "P2002" : (e?.message || ultimoError)
      return null
    })
    if (!creado) {
      if (ultimoError === "P2002") continue
      return NextResponse.json({ error: ultimoError }, { status: 400 })
    }
    const aplicados: { id: string; cantidad: number }[] = []
    try {
      for (const linea of fisicos) {
        const bajo = await prisma.producto.updateMany({
          where: { id: linea.id, empresaId: sesion.empresa.id, stock: { gte: linea.cantidad } },
          data: { stock: { decrement: linea.cantidad } },
        })
        if (!bajo.count) throw new Error(`No hay stock de ${linea.nombre}`)
        aplicados.push({ id: linea.id, cantidad: linea.cantidad })
        await prisma.kardexMovimiento.create({
          data: {
            empresaId: sesion.empresa.id,
            productoId: linea.id,
            productoCodigo: linea.codigo,
            productoNombre: linea.nombre,
            tipo: "SALIDA",
            detalle: `Ticket interno ${punto.estab}-${punto.pto}-${String(numero).padStart(9, "0")}`,
            cantidadSalida: linea.cantidad,
            costoEntrada: linea.costo,
            usuario: sesion.usuario.nombre || "",
          },
        })
      }
      return NextResponse.json({
        ok: true,
        ticket: creado,
        numero: `${punto.estab}-${punto.pto}-${String(numero).padStart(9, "0")}`,
        empresa: {
          ruc: sesion.empresa.ruc,
          razonSocial: sesion.empresa.razonSocial,
          nombreComercial: sesion.empresa.nombreComercial || sesion.empresa.nombre || "",
          direccion: sesion.empresa.direccion || "",
        },
      })
    } catch (e) {
      for (const linea of aplicados) {
        await prisma.producto.updateMany({
          where: { id: linea.id, empresaId: sesion.empresa.id },
          data: { stock: { increment: linea.cantidad } },
        }).catch(() => {})
      }
      await prisma.kardexMovimiento.deleteMany({
        where: { empresaId: sesion.empresa.id, detalle: `Ticket interno ${punto.estab}-${punto.pto}-${String(numero).padStart(9, "0")}` },
      }).catch(() => {})
      await prisma.ticketInterno.delete({ where: { id: creado.id } }).catch(() => {})
      ultimoError = e instanceof Error ? e.message : ultimoError
      return NextResponse.json({ error: ultimoError }, { status: 400 })
    }
  }
  return NextResponse.json({ error: "No se pudo numerar el ticket. Inténtalo de nuevo." }, { status: 400 })
}
