import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { codigoAmbiente } from "@/lib/sri/ambiente"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    ruc: "",
    razonSocial: "",
    nombreComercial: "",
    regimen: "",
    obligadoContabilidad: "",
  })
}

export async function POST(request: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(request)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador cambia la empresa" }, { status: 403 })
  const datos = await request.json().catch(() => ({}))
  if (datos?.firma && typeof datos.firma === "object") datos.firma.clave = ""
  const empresa = sesion.empresa
  const prev = empresa.datosRegistro && typeof empresa.datosRegistro === "object" && !Array.isArray(empresa.datosRegistro)
    ? empresa.datosRegistro as Record<string, unknown>
    : {}
  const ambienteSri = codigoAmbiente(datos.ambiente ?? prev.ambiente ?? empresa.ambienteSri)
  await prisma.empresa.update({
    where: { id: empresa.id },
    data: {
      razonSocial: datos.razonSocial || empresa.razonSocial,
      nombreComercial: datos.nombreComercial ?? empresa.nombreComercial,
      direccion: datos.dirMatriz || datos.direccion || empresa.direccion,
      telefono: datos.telefono ?? empresa.telefono,
      email: datos.email ?? empresa.email,
      ambienteSri,
      datosRegistro: {
        ...prev,
        regimen: datos.regimen ?? prev.regimen ?? "",
        obligadoConta: datos.obligadoConta ?? prev.obligadoConta ?? "",
        ambiente: ambienteSri === "2" ? "PRODUCCIÓN" : "PRUEBAS",
        ambienteCodigo: ambienteSri,
        dirMatriz: datos.dirMatriz ?? prev.dirMatriz ?? "",
        dirEstablecimiento: datos.dirEstablecimiento ?? prev.dirEstablecimiento ?? "",
        sucursales: datos.sucursales ?? prev.sucursales ?? [],
        logoUrl: datos.logo_url || datos.logoUrl || prev.logo_url || prev.logoUrl || "",
        logo_url: datos.logo_url || datos.logoUrl || prev.logo_url || prev.logoUrl || "",
        provincia: datos.provincia ?? prev.provincia ?? "",
        ciudad: datos.ciudad ?? prev.ciudad ?? "",
        actividad: datos.actividad ?? prev.actividad ?? "",
        modo_negocio: datos.modo_negocio ?? prev.modo_negocio ?? "",
      } as any,
    },
  })
  return NextResponse.json({ ok: true })
}
