import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    const body = await req.json()
    const factura = await prisma.facturaEmitida.create({
      data: {
        empresaId: sesion.empresa.id,
        estado: String(body.estadoSRI || body.estado || "EMITIDA"),
        payload: body,
      },
    })
    return NextResponse.json({ id: factura.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo guardar la factura" }, { status: 500 })
  }
}
