import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { guardarCertificado } from "@/lib/security/certificado"
import { esquemaCertificado } from "@/lib/security/esquemas"

export const dynamic = "force-dynamic"

const archivo = z.object({
  tipo: z.string(),
  peso: z.number().positive().max(2_000_000),
})

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador sube la firma" }, { status: 403 })
  const seguridad = await prisma.usuarioSeguridad.findUnique({ where: { usuarioId: sesion.usuario.id } })
  if (!seguridad?.dosFaActivo) {
    return NextResponse.json({ error: "Activa el segundo factor antes de subir o reemplazar la firma" }, { status: 403 })
  }
  const form = await req.formData().catch(() => null)
  const file = form?.get("p12")
  const clave = String(form?.get("clave") || "")
  if (!(file instanceof File)) return NextResponse.json({ error: "Sube el archivo .p12" }, { status: 400 })
  const nombreOk = esquemaCertificado.safeParse({ clave, nombre: file.name || "firma.p12" })
  const archivoOk = archivo.safeParse({ tipo: file.type || "application/x-pkcs12", peso: file.size })
  if (!nombreOk.success || !archivoOk.success) return NextResponse.json({ error: "El certificado o la contraseña no son válidos" }, { status: 400 })
  if (!file.name.toLowerCase().endsWith(".p12") && !file.name.toLowerCase().endsWith(".pfx")) {
    return NextResponse.json({ error: "Solo se acepta .p12 o .pfx" }, { status: 400 })
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  try {
    const guardado = await guardarCertificado({
      empresaId: sesion.empresa.id,
      rucEmpresa: sesion.empresa.ruc,
      nombre: file.name,
      p12: bytes,
      clave,
    })
    return NextResponse.json({ ok: true, guardada: true, expira: guardado.expira, dias: guardado.dias, valido: true, rucCoincide: true })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo guardar el certificado"
    const conocido = /contraseña|caducado|coincide|certificado|bucket|ENCRYPTION_MASTER_KEY|SUPABASE_/i.test(mensaje)
    return NextResponse.json({ ok: false, error: conocido ? mensaje : "No se pudo guardar el certificado" }, { status: 400 })
  }
}
