import { NextRequest, NextResponse } from "next/server"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { guardarCertificado } from "@/lib/security/certificado"
import { confirmaClaveIngreso } from "@/lib/seguridad"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ ok: false, error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ ok: false, error: "Solo el administrador sube la firma" }, { status: 403 })
  const formData = await req.formData().catch(() => null)
  const file = formData?.get("p12")
  const clave = String(formData?.get("clave") || "")
  const password = String(formData?.get("password") || "")
  if (!(await confirmaClaveIngreso(sesion.usuario.password, password))) {
    return NextResponse.json({ ok: false, error: "Confirma tu contraseña de ingreso para cambiar la firma" }, { status: 401 })
  }
  if (!(file instanceof File) || !clave) return NextResponse.json({ ok: false, error: "Sube el archivo .p12 y su contraseña" }, { status: 400 })
  const bytes = Buffer.from(await file.arrayBuffer())
  try {
    const guardado = await guardarCertificado({
      empresaId: sesion.empresa.id,
      rucEmpresa: sesion.empresa.ruc,
      nombre: file.name || "firma.p12",
      p12: bytes,
      clave,
    })
    return NextResponse.json({
      ok: true,
      guardada: true,
      claveGuardada: true,
      ruc: sesion.empresa.ruc,
      rucCoincide: true,
      vinculada: true,
      vigente: true,
      valido: true,
      titular: guardado.titular,
      expira: guardado.expira,
      fechaExpiracion: guardado.expira,
      dias: guardado.dias,
      diasRestantes: guardado.dias,
    })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo guardar el certificado"
    const conocido = /contraseña|caducado|coincide|certificado|bucket|ENCRYPTION_MASTER_KEY|SUPABASE_/i.test(mensaje)
    return NextResponse.json({ ok: false, error: conocido ? mensaje : "No se pudo guardar el certificado" }, { status: 400 })
  }
}
