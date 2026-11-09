import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cerrarSesion } from "@/lib/login-memoria"
import { claveValida } from "@/lib/seguridad"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token = String(body.token || "")
  const clave = claveValida(String(body.password || ""))
  if (clave) return NextResponse.json({ error: clave }, { status: 400 })
  const reset = await prisma.passwordReset.findUnique({ where: { id: token } })
  if (!reset || reset.usado || reset.expira < new Date()) return NextResponse.json({ error: "El enlace venció" }, { status: 400 })
  await prisma.usuario.update({ where: { id: reset.usuarioId }, data: { password: await bcrypt.hash(String(body.password), 10) } })
  await prisma.passwordReset.update({ where: { id: token }, data: { usado: true } })
  const sesiones = await prisma.sesionUsuario.findMany({ where: { usuarioId: reset.usuarioId } })
  await prisma.sesionUsuario.updateMany({ where: { usuarioId: reset.usuarioId }, data: { revocada: true } })
  sesiones.forEach((s) => cerrarSesion(s.id))
  await prisma.seguridadLog.create({ data: { usuario: reset.usuarioId, accion: "CAMBIO_CLAVE" } })
  return NextResponse.json({ ok: true })
}
