import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { ambienteSri, envioSriPermitido } from "@/lib/sri/ambiente"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const extra = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
    ? sesion.empresa.datosRegistro as Record<string, unknown>
    : {}
  const ambiente = ambienteSri(extra.ambiente || extra.ambienteCodigo)
  const firma = await prisma.firmaElectronica.findUnique({ where: { empresaId: sesion.empresa.id } })
  const certificado = await prisma.certificadoSri.findUnique({ where: { empresaId: sesion.empresa.id }, select: { claveCifrada: true } })
  const obligado = String(extra.obligadoConta || extra.obligado || "").trim().toUpperCase()
  const faltantes: string[] = []
  if (!firma) faltantes.push("Falta el archivo .p12")
  else if (firma.expira.getTime() < Date.now()) faltantes.push("El certificado .p12 está vencido")
  if (String(sesion.empresa.ruc || "").replace(/\D/g, "").length !== 13) faltantes.push("Falta el RUC del emisor")
  if (!String(sesion.empresa.razonSocial || "").trim()) faltantes.push("Falta la razón social")
  if (!String(extra.dirMatriz || sesion.empresa.direccion || "").trim()) faltantes.push("Falta la dirección matriz")
  if (obligado !== "SI" && obligado !== "NO") faltantes.push("Falta obligado a llevar contabilidad (SI o NO)")
  return NextResponse.json({
    ambiente: ambiente.codigo,
    ambienteNombre: ambiente.nombre,
    recepcion: ambiente.recepcion,
    autorizacion: ambiente.autorizacion,
    envioHabilitado: envioSriPermitido(ambiente.codigo),
    firmaCargada: Boolean(firma),
    firmaNombre: firma?.nombre || "",
    firmaExpira: firma?.expira || sesion.empresa.firmaExpira,
    claveGuardada: Boolean(certificado?.claveCifrada),
    faltantes,
  })
}
