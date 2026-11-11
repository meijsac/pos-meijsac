import { NextResponse } from "next/server"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { confirmaClaveIngreso } from "@/lib/seguridad"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const ok = await confirmaClaveIngreso(sesion.usuario.password, String(body.password || ""))
  if (!ok) return NextResponse.json({ error: "Confirma tu contraseña" }, { status: 401 })
  return NextResponse.json({ ok: true })
}
