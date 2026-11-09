import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"

function fila(m: {
  id: string
  productoId: string
  productoCodigo: string
  productoNombre: string
  sucursal: string
  fecha: Date
  tipo: string
  detalle: string
  cantidadEntrada: number
  cantidadSalida: number
  costoEntrada: number
  usuario: string
  transferenciaId: string | null
}) {
  return {
    id: m.id,
    productoId: m.productoId,
    productoCodigo: m.productoCodigo,
    productoNombre: m.productoNombre,
    sucursal: m.sucursal,
    fecha: m.fecha.toISOString(),
    tipo: m.tipo,
    detalle: m.detalle,
    cantidadEntrada: m.cantidadEntrada,
    cantidadSalida: m.cantidadSalida,
    costoEntrada: m.costoEntrada,
    usuario: m.usuario,
    transferenciaId: m.transferenciaId,
  }
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "kardex")) return NextResponse.json({ error: "Tu rol no puede ver el kárdex" }, { status: 403 })
  const movimientos = await prisma.kardexMovimiento.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { fecha: "asc" },
  })
  return NextResponse.json({ movimientos: movimientos.map(fila) })
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "kardex")) return NextResponse.json({ error: "Tu rol no puede ver el kárdex" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const lista = Array.isArray(body.movimientos) ? body.movimientos : [body]
  const creados = []
  for (const item of lista) {
    const entrada = Number(item.cantidadEntrada) || 0
    const salida = Number(item.cantidadSalida) || 0
    if (!item.productoId || (entrada <= 0 && salida <= 0)) continue
    const tipo = String(item.tipo || (entrada > 0 ? "ENTRADA" : "SALIDA")).toUpperCase()
    const creado = await prisma.kardexMovimiento.create({
      data: {
        empresaId: sesion.empresa.id,
        productoId: String(item.productoId),
        productoCodigo: String(item.productoCodigo || ""),
        productoNombre: String(item.productoNombre || ""),
        sucursal: String(item.sucursal || "PRINCIPAL"),
        fecha: item.fecha ? new Date(item.fecha) : new Date(),
        tipo,
        detalle: String(item.detalle || ""),
        cantidadEntrada: entrada,
        cantidadSalida: salida,
        costoEntrada: Number(item.costoEntrada) || 0,
        usuario: sesion.usuario.nombre || "",
        transferenciaId: item.transferenciaId ? String(item.transferenciaId) : null,
      },
    })
    creados.push(fila(creado))
  }
  return NextResponse.json({ movimientos: creados })
}
