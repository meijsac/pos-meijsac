import { NextResponse } from "next/server"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

function fechaLimpia(fecha: unknown) {
  const dia = String(fecha || "").match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (dia) return `${dia[1]}/${dia[2]}/${dia[3]}`
  return ""
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ mensaje: sesion.error }, { status: sesion.status })
  const periodo = new URL(req.url).searchParams.get("periodo") || ""
  const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
    ? sesion.empresa.datosRegistro as Record<string, unknown>
    : {}
  const lista = Array.isArray(extra.comprasRecibidas) ? extra.comprasRecibidas as Record<string, any>[] : []
  const filas = lista.filter((c) => {
    const fecha = fechaLimpia(c.fechaEmision)
    const mes = fecha ? `${fecha.slice(6)}-${fecha.slice(3, 5)}` : ""
    return !periodo || mes === periodo
  })
  const lineas = ["Proveedor,RUC,Comprobante,Fecha,Subtotal,IVA,Total,Estado", ...filas.map((c) => {
    const subtotal = Number(c.subtotalIva15 || 0) + Number(c.subtotalIva0 || 0) + Number(c.subtotalNoObjeto || 0) + Number(c.subtotalExento || 0)
    return [
      `"${String(c.razonSocialProveedor || "").replace(/"/g, "")}"`,
      c.rucProveedor,
      c.secuencial,
      fechaLimpia(c.fechaEmision),
      subtotal.toFixed(2),
      Number(c.valorIva || 0).toFixed(2),
      Number(c.totalDocumento || 0).toFixed(2),
      c.estadoAts === "RETENIDO" ? "Retenido" : "Por retener",
    ].join(",")
  })]
  return new NextResponse(lineas.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compras-${periodo || "todas"}.csv"`,
    },
  })
}
