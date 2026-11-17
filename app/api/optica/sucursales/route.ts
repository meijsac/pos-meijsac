import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { datosRegistroDe, usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export async function GET(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const guardadas = await prisma.establecimientoSri.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { codigo: "asc" },
  })
  if (guardadas.length) {
    return NextResponse.json({
      sucursales: guardadas.map((fila) => ({ id: fila.id, codigo: fila.codigo, nombre: fila.nombre || `Establecimiento ${fila.codigo}`, direccion: fila.direccion })),
    })
  }
  const extra = datosRegistroDe(sesion.empresa.datosRegistro)
  const lista = Array.isArray(extra.sucursales) ? extra.sucursales : []
  const sucursales = lista.map((fila) => {
    const sucursal = fila as Record<string, unknown>
    const codigo = String(sucursal.codigo || sucursal.estab || "").replace(/\D/g, "").padStart(3, "0").slice(-3)
    return { id: "", codigo, nombre: String(sucursal.nombre || sucursal.direccion || "Sucursal"), direccion: String(sucursal.direccion || "") }
  }).filter((fila) => fila.codigo && fila.codigo !== "000")
  return NextResponse.json({ sucursales })
}
