import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { encriptar, hashCodigo } from "@/lib/seguridad"

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador activa 2FA" }, { status: 403 })
  const secreto = randomBytes(20).toString("base64")
  const respaldos = Array.from({ length: 8 }, () => String(Math.floor(10000000 + Math.random() * 90000000)))
  await prisma.usuarioSeguridad.upsert({
    where: { usuarioId: sesion.usuario.id },
    update: { dosFaActivo: true, totpCifrado: encriptar(secreto), respaldos: respaldos.map(hashCodigo).join(",") },
    create: { usuarioId: sesion.usuario.id, dosFaActivo: true, totpCifrado: encriptar(secreto), respaldos: respaldos.map(hashCodigo).join(",") },
  })
  await prisma.seguridadLog.create({ data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, accion: "2FA_ACTIVADO" } })
  return NextResponse.json({ secreto, respaldos })
}
