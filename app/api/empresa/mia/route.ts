import { NextResponse } from "next/server"
import { empresaParaCliente, usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

export async function GET(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
    return NextResponse.json({
      empresa: empresaParaCliente(sesion.empresa, sesion.usuario),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo cargar la empresa" }, { status: 500 })
  }
}
