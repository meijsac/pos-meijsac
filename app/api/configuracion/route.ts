import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { datosRegistroDe, usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { codigoAmbiente } from "@/lib/sri/ambiente"
import { puede } from "@/lib/seguridad"

function limpiarSecuenciales(lista: unknown) {
  if (!Array.isArray(lista)) return undefined
  return lista.slice(0, 40).map((s: any) => ({
    estab: String(s?.estab || "").replace(/\D/g, "").padStart(3, "0").slice(-3),
    pto: String(s?.pto || "").replace(/\D/g, "").padStart(3, "0").slice(-3),
    codigo: String(s?.codigo || "01").replace(/\D/g, "").padStart(2, "0").slice(-2),
    tipo: String(s?.tipo || "").slice(0, 40),
    ultimo: String(s?.ultimo || "").replace(/\D/g, "").padStart(9, "0").slice(-9),
    estado: String(s?.estado || "ACTIVO").slice(0, 20) || "ACTIVO",
    actualizadoEn: String(s?.actualizadoEn || "").slice(0, 40),
  })).filter((s) => s.estab !== "000" && s.pto !== "000")
}

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
  const datos = await request.json().catch(() => ({}))
  if (datos?.firma && typeof datos.firma === "object") datos.firma.clave = ""
  const empresa = sesion.empresa
  const prev = datosRegistroDe(empresa.datosRegistro)
  const secuenciales = limpiarSecuenciales(datos.secuenciales)
  const listaGuardada = secuenciales && secuenciales.length ? secuenciales : undefined
  if (sesion.usuario.rol !== "ADMIN") {
    if (!puede(sesion.usuario.rol, "facturar") || !listaGuardada) return NextResponse.json({ error: "Solo el administrador cambia la empresa" }, { status: 403 })
    await prisma.empresa.update({
      where: { id: empresa.id },
      data: { datosRegistro: { ...prev, secuenciales: listaGuardada } as any },
    })
    return NextResponse.json({ ok: true, secuenciales: listaGuardada })
  }
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
        ...(listaGuardada ? { secuenciales: listaGuardada } : {}),
      } as any,
    },
  })
  return NextResponse.json({ ok: true, secuenciales: listaGuardada || prev.secuenciales || [] })
}
