import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!puede(sesion.usuario.rol, "respaldo") && sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador ve la actividad" }, { status: 403 })
  const eventos = await prisma.seguridadLog.findMany({
    where: { OR: [{ empresaId: sesion.empresa.id }, { empresaId: null }] },
    orderBy: { fecha: "desc" },
    take: 50,
  })
  return NextResponse.json({
    eventos: eventos.map((e) => ({ id: e.id, fecha: e.fecha.toISOString(), usuario: e.usuario, ip: e.ip, accion: e.accion, dispositivo: e.dispositivo })),
  })
}
