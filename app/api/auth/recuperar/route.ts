import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const ruc = String(body.ruc || "").trim()
  const usuario = await prisma.usuario.findFirst({ where: { empresa: { ruc } }, include: { empresa: true } })
  if (!usuario?.email) return NextResponse.json({ mensaje: "Si el RUC existe, enviaremos el enlace al correo registrado." })
  const id = randomBytes(24).toString("hex")
  await prisma.passwordReset.create({ data: { id, usuarioId: usuario.id, expira: new Date(Date.now() + 15 * 60 * 1000) } })
  await prisma.seguridadLog.create({ data: { empresaId: usuario.empresaId, usuario: usuario.nombre, accion: "RECUPERAR_CLAVE", detalle: "enlace de un solo uso, 15 minutos" } }).catch(() => {})
  return NextResponse.json({ mensaje: "Si el RUC existe, enviaremos el enlace al correo registrado. Vence en 15 minutos y solo sirve una vez." })
}
