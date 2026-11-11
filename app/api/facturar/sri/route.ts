import { NextResponse } from "next/server"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { encolarReenvioSri } from "@/lib/security/cola"
import { reenviarClaveSri } from "@/lib/sri/reenviar-pendiente"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    const pedido = await req.json().catch(() => ({}))
    const clave = String(pedido?.claveAcceso || "").replace(/\D/g, "")
    if (clave.length !== 49) return NextResponse.json({ error: "Falta la clave de acceso" }, { status: 400 })
    if (process.env.QSTASH_TOKEN) {
      const encolado = await encolarReenvioSri(sesion.empresa.id, clave).catch(() => false)
      if (encolado) return NextResponse.json({ encolado: true, estado: "PENDIENTE", mensaje: "El envío quedó en cola." })
    }
    const resultado = await reenviarClaveSri(sesion.empresa.id, clave)
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status })
    return NextResponse.json(resultado.datos)
  } catch (e: any) {
    const code = String(e?.cause?.code || e?.code || e?.codigo || "")
    if (e?.name === "TimeoutError" || code === "Timeout" || code === "ETIMEDOUT") {
      return NextResponse.json({ conectado: false, estado: "PENDIENTE", error: "El SRI tardó demasiado en responder (Timeout)." }, { status: 504 })
    }
    return NextResponse.json({ conectado: false, estado: "PENDIENTE", error: "No se pudo consultar al SRI" }, { status: 500 })
  }
}
