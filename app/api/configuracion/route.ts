import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { datosRegistroDe, usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { codigoAmbiente } from "@/lib/sri/ambiente"
import { asegurarPunto } from "@/lib/pos/puntos"
import { permisosDeUsuario } from "@/lib/permisos-pos"
import { puede } from "@/lib/seguridad"
import { fusionarSecuenciales } from "@/lib/sri/punto-emision"

async function guardarPuntos(empresaId: string, secuenciales: { estab: string; pto: string }[] | undefined, sucursales: unknown) {
  const puntos = new Map<string, { estab: string; pto: string; nombre: string; direccion: string }>()
  const agregar = (estab: unknown, pto: unknown, nombre = "", direccion = "") => {
    const codigoEstab = String(estab ?? "").replace(/\D/g, "").padStart(3, "0").slice(-3)
    const codigoPto = String(pto ?? "").replace(/\D/g, "").padStart(3, "0").slice(-3)
    if (codigoEstab === "000" || codigoPto === "000") return
    const clave = `${codigoEstab}-${codigoPto}`
    const previo = puntos.get(clave)
    if (!previo) puntos.set(clave, { estab: codigoEstab, pto: codigoPto, nombre, direccion })
    else if (nombre && !previo.nombre) {
      previo.nombre = nombre
      previo.direccion = direccion || previo.direccion
    }
  }
  for (const fila of Array.isArray(secuenciales) ? secuenciales : []) agregar(fila.estab, fila.pto)
  if (Array.isArray(sucursales)) {
    for (const fila of sucursales) {
      const s = fila as { id?: string; nombre?: string; dir?: string; ptoEmision?: string }
      agregar(s.id, s.ptoEmision || "001", String(s.nombre || ""), String(s.dir || ""))
    }
  }
  const porEstab = new Map<string, { estab: string; pto: string; nombre: string; direccion: string }[]>()
  for (const fila of puntos.values()) {
    const grupo = porEstab.get(fila.estab) || []
    grupo.push(fila)
    porEstab.set(fila.estab, grupo)
  }
  await Promise.all([...porEstab.values()].map(async (grupo) => {
    for (const fila of grupo) await asegurarPunto(empresaId, fila.estab, fila.pto, fila.nombre, fila.direccion).catch(() => null)
  }))
}

function limpiarSecuenciales(lista: unknown) {
  if (!Array.isArray(lista)) return undefined
  return lista.slice(0, 40).map((s: any) => ({
    estab: String(s?.estab || "").replace(/\D/g, "").padStart(3, "0").slice(-3),
    pto: String(s?.pto || "").replace(/\D/g, "").padStart(3, "0").slice(-3),
    codigo: String(s?.codigo || "01").replace(/\D/g, "").padStart(2, "0").slice(-2),
    tipo: String(s?.tipo || "").slice(0, 40),
    ultimo: String(s?.ultimo || "").replace(/\D/g, "").padStart(9, "0").slice(-9),
    porAmbiente: {
      "1": String(s?.porAmbiente?.["1"] || "").replace(/\D/g, "").replace(/^0+$/, "").padStart(9, "0").slice(-9).replace(/^0{9}$/, ""),
      "2": String(s?.porAmbiente?.["2"] || "").replace(/\D/g, "").replace(/^0+$/, "").padStart(9, "0").slice(-9).replace(/^0{9}$/, ""),
    },
    estado: String(s?.estado || "ACTIVO").slice(0, 20) || "ACTIVO",
    preferida: s?.preferida === true,
    actualizadoEn: String(s?.actualizadoEn || "").slice(0, 40),
  })).filter((s) => s.estab !== "000" && s.pto !== "000")
}

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(request)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const extra = datosRegistroDe(sesion.empresa.datosRegistro)
  return NextResponse.json({
    secuenciales: Array.isArray(extra.secuenciales) ? extra.secuenciales : [],
    ambiente: String(sesion.empresa.ambienteSri || extra.ambienteCodigo || extra.ambiente || "1"),
  })
}

export async function POST(request: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(request)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const datos = await request.json().catch(() => ({}))
  if (datos?.firma && typeof datos.firma === "object") datos.firma.clave = ""
  const empresa = sesion.empresa
  const prev = datosRegistroDe(empresa.datosRegistro)
  const envioLista = Array.isArray(datos.secuenciales)
  const fusion = fusionarSecuenciales(prev.secuenciales, envioLista ? datos.secuenciales : prev.secuenciales, datos.sucursales ?? prev.sucursales)
  const listaGuardada = limpiarSecuenciales(fusion) || []
  if (envioLista) {
    console.log("[secuencial] recibido", datos.secuenciales.map((s: any) => ({ estab: s?.estab, pto: s?.pto, ultimo: s?.ultimo, editado: s?.puntoEditado === true })))
  }
  if (sesion.usuario.rol !== "ADMIN") {
    const permisos = permisosDeUsuario(sesion.usuario)
    if (permisos && !permisos.modificarSecuenciales) return NextResponse.json({ error: "No tienes permiso para cambiar el secuencial" }, { status: 403 })
    if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Solo el administrador cambia la empresa" }, { status: 403 })
    await prisma.empresa.update({
      where: { id: empresa.id },
      data: { datosRegistro: { ...prev, secuenciales: listaGuardada } as any },
    })
    await guardarPuntos(empresa.id, listaGuardada, undefined)
    const fresca = await prisma.empresa.findUnique({ where: { id: empresa.id }, select: { datosRegistro: true } })
    const quedo = datosRegistroDe(fresca?.datosRegistro).secuenciales
    console.log("[secuencial] guardado", quedo)
    return NextResponse.json({ ok: true, secuenciales: Array.isArray(quedo) ? quedo : [] })
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
        secuenciales: listaGuardada,
      } as any,
    },
  })
  await guardarPuntos(empresa.id, listaGuardada, datos.sucursales)
  const fresca = await prisma.empresa.findUnique({ where: { id: empresa.id }, select: { datosRegistro: true } })
  const quedo = datosRegistroDe(fresca?.datosRegistro).secuenciales
  console.log("[secuencial] guardado", Array.isArray(quedo) ? quedo.map((s: any) => ({ estab: s?.estab, pto: s?.pto, ultimo: s?.ultimo })) : [])
  return NextResponse.json({ ok: true, secuenciales: Array.isArray(quedo) ? quedo : [] })
}
