import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { encriptar } from "@/lib/seguridad"

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador descarga respaldos" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (!(await bcrypt.compare(String(body.password || ""), sesion.usuario.password))) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 })
  }
  const [facturas, clientes] = await Promise.all([
    prisma.facturaEmitida.findMany({ where: { empresaId: sesion.empresa.id }, take: 500 }),
    prisma.cliente.findMany({ where: { empresaId: sesion.empresa.id } }),
  ])
  const paquete = encriptar(JSON.stringify({ empresa: sesion.empresa.id, facturas, clientes, en: new Date().toISOString() }))
  await prisma.seguridadLog.create({ data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, accion: "RESPALDO", detalle: "descarga cifrada" } })
  return new NextResponse(paquete, { headers: { "Content-Type": "application/octet-stream" } })
}
