import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { encryptBuffer } from "@/lib/security/crypto"
import { confirmaClaveIngreso } from "@/lib/seguridad"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const firma = await prisma.certificadoSri.findUnique({
    where: { empresaId: sesion.empresa.id },
    select: { nombre: true, expira: true, claveCifrada: true },
  })
  return NextResponse.json({
    guardada: Boolean(firma?.claveCifrada),
    nombre: firma?.nombre || "",
    expira: firma?.expira ? firma.expira.toISOString() : "",
    clave: "",
  })
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador guarda la contraseña" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const clave = String(body?.clave || "")
  const password = String(body?.password || "")
  if (!(await confirmaClaveIngreso(sesion.usuario.password, password))) {
    return NextResponse.json({ error: "Confirma tu contraseña de ingreso para cambiar la firma" }, { status: 401 })
  }
  if (!clave) return NextResponse.json({ error: "Escribe la contraseña del .p12" }, { status: 400 })
  const firma = await prisma.certificadoSri.findUnique({ where: { empresaId: sesion.empresa.id } })
  if (!firma) return NextResponse.json({ error: "Primero sube el archivo .p12" }, { status: 400 })
  const cifrada = encryptBuffer(Buffer.from(clave, "utf8"))
  await prisma.certificadoSri.update({
    where: { empresaId: sesion.empresa.id },
    data: {
      claveCifrada: cifrada.encryptedData.toString("base64"),
      claveIv: cifrada.iv.toString("base64"),
      claveTag: cifrada.authTag.toString("base64"),
    },
  })
  cifrada.encryptedData.fill(0)
  return NextResponse.json({ ok: true, guardada: true })
}
