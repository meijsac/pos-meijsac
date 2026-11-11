import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

function extraDe(datos: unknown) {
  return datos && typeof datos === "object" && !Array.isArray(datos) ? datos as Record<string, unknown> : {}
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ mensaje: sesion.error }, { status: sesion.status })
    const { id } = await context.params
    const extra = extraDe(sesion.empresa.datosRegistro)
    const lista = Array.isArray(extra.comprasRecibidas) ? extra.comprasRecibidas as Record<string, any>[] : []
    const compra = lista.find((c) => String(c.id) === id)
    if (!compra) return NextResponse.json({ mensaje: "No encontré esa compra." }, { status: 404 })
    if (compra.estadoAts === "RETENIDO") return NextResponse.json({ mensaje: "Esta compra ya tiene una retención autorizada y no se puede borrar." }, { status: 409 })
    await prisma.empresa.update({
      where: { id: sesion.empresa.id },
      data: { datosRegistro: { ...extra, comprasRecibidas: lista.filter((c) => String(c.id) !== id) } },
    })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo eliminar la compra."
    return NextResponse.json({ mensaje }, { status: 500 })
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ mensaje: sesion.error }, { status: sesion.status })
    const { id } = await context.params
    const body = await req.json()
    const clave = String(body?.claveRetencion || "").replace(/\D/g, "")
    if (clave.length !== 49) return NextResponse.json({ mensaje: "La retención no tiene clave de acceso." }, { status: 400 })
    const extra = extraDe(sesion.empresa.datosRegistro)
    const lista = Array.isArray(extra.comprasRecibidas) ? extra.comprasRecibidas as Record<string, any>[] : []
    const siguiente = lista.map((c) => String(c.id) === id ? { ...c, estadoAts: "RETENIDO", claveRetencion: clave, numRetencion: String(body?.numero || "") } : c)
    await prisma.empresa.update({
      where: { id: sesion.empresa.id },
      data: { datosRegistro: { ...extra, comprasRecibidas: siguiente } },
    })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "No se pudo actualizar la compra."
    return NextResponse.json({ mensaje }, { status: 500 })
  }
}
