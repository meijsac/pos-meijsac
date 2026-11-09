import jwt from "jsonwebtoken"
import type { Empresa, Usuario } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { abrirSesion, sesionViva } from "@/lib/login-memoria"
import { ipDe, navegadorDe } from "@/lib/seguridad"

export function secretoJwt() {
  const secreto = process.env.JWT_SECRET || ""
  if (!secreto || secreto === "MEIJSAC_SECRET_2026") throw new Error("JWT_SECRET no configurado")
  return secreto
}

type Extra = Record<string, unknown>

export function empresaParaCliente(
  empresa: Empresa,
  usuario: Pick<Usuario, "nombre" | "rol" | "empresaId">
) {
  const extra =
    empresa.datosRegistro && typeof empresa.datosRegistro === "object" && !Array.isArray(empresa.datosRegistro)
      ? (empresa.datosRegistro as Extra)
      : {}
  const ciudad = String(extra.ciudad || extra.canton || "")
  const obligado = String(extra.obligadoConta || extra.obligado || "")
  return {
    id: empresa.id,
    empresaId: usuario.empresaId,
    ruc: empresa.ruc,
    razon: empresa.razonSocial,
    razonSocial: empresa.razonSocial,
    nombre: empresa.nombre || "",
    nombreComercial: empresa.nombreComercial || empresa.nombre || "",
    direccion: empresa.direccion || "",
    telefono: empresa.telefono || "",
    email: empresa.email || "",
    correo: empresa.email || "",
    provincia: String(extra.provincia || ""),
    ciudad,
    canton: String(extra.canton || ciudad),
    regimen: String(extra.regimen || ""),
    ambiente: String(extra.ambiente || ""),
    dirMatriz: String(extra.dirMatriz || empresa.direccion || ""),
    dirEstablecimiento: String(extra.dirEstablecimiento || ""),
    sucursales: Array.isArray(extra.sucursales) ? extra.sucursales : [],
    logoUrl: String(extra.logo_url || extra.logoUrl || extra.marca_ride || ""),
    logo_url: String(extra.logo_url || extra.logoUrl || extra.marca_ride || ""),
    marca_ride: String(extra.marca_ride || extra.logo_url || extra.logoUrl || ""),
    actividad: String(extra.actividad || ""),
    obligado,
    obligadoConta: obligado,
    contribuyenteEspecial: String(extra.contribuyenteEspecial || ""),
    tipoContribuyente: String(extra.tipoContribuyente || ""),
    sector: String(extra.sector || ""),
    modo_negocio: String(extra.modo_negocio || ""),
    celular: String(extra.celular || ""),
    respNombre: String(extra.respNombre || ""),
    respCelular: String(extra.respCelular || ""),
    usuario: usuario.nombre,
    rol: usuario.rol,
  }
}

export function firmarSesion(usuario: { id: string; empresaId: string; sid: string; ip: string; ua: string }, dias?: "7d") {
  return jwt.sign(
    { id: usuario.id, empresaId: usuario.empresaId, sid: usuario.sid, ip: usuario.ip, ua: usuario.ua },
    secretoJwt(),
    { expiresIn: dias || "1h" }
  )
}

function leerCookie(req: Request, nombre: string) {
  const raw = req.headers.get("cookie") || ""
  const parte = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${nombre}=`))
  return parte ? decodeURIComponent(parte.slice(nombre.length + 1)) : ""
}

export function cookiesSesion(acceso: string, refresh: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return [
    `meijsac_sesion=${acceso}; HttpOnly; Path=/; SameSite=Strict${secure}`,
    `meijsac_refresh=${refresh}; HttpOnly; Path=/api/auth; SameSite=Strict${secure}`,
  ]
}

export function cookiesCerradas() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return [
    `meijsac_sesion=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`,
    `meijsac_refresh=; HttpOnly; Path=/api/auth; SameSite=Strict; Max-Age=0${secure}`,
  ]
}

export async function usuarioConEmpresaDesdeRequest(req: Request) {
  const header = req.headers.get("authorization") || ""
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  const token = leerCookie(req, "meijsac_sesion") || (bearer && bearer !== "ok" && !bearer.startsWith("ok-") && bearer !== "demo" ? bearer : "")
  if (!token) return { error: "No hay sesión. Vuelve a entrar.", status: 401 as const }
  let payload: { id?: string; empresaId?: string; sid?: string; ip?: string; ua?: string }
  try {
    payload = jwt.verify(token, secretoJwt()) as { id?: string; empresaId?: string; sid?: string; ip?: string; ua?: string }
  } catch {
    return { error: "Sesión vencida. Vuelve a entrar.", status: 401 as const }
  }
  if (!payload.id || !payload.sid) return { error: "Sesión vencida. Vuelve a entrar.", status: 401 as const }
  let viva = sesionViva(payload.sid)
  if (!viva) {
    try {
      const fila = await prisma.sesionUsuario.findUnique({ where: { id: payload.sid } })
      viva = !!fila && !fila.revocada && fila.expira > new Date() && Date.now() - fila.updatedAt.getTime() < 8 * 60 * 60 * 1000
      if (viva) {
        abrirSesion(payload.sid)
        await prisma.sesionUsuario.update({ where: { id: payload.sid }, data: { updatedAt: new Date() } })
      }
    } catch {
      viva = false
    }
  }
  if (!viva) return { error: "Sesión vencida. Vuelve a entrar.", status: 401 as const }
  if (payload.ip && payload.ip !== ipDe(req)) return { error: "La red cambió. Vuelve a entrar.", status: 401 as const }
  if (payload.ua && payload.ua !== navegadorDe(req)) return { error: "El navegador cambió. Vuelve a entrar.", status: 401 as const }

  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.id },
    include: { empresa: true },
  })
  if (!usuario) return { error: "Usuario no encontrado", status: 404 as const }
  if (!usuario.empresaId || !usuario.empresa) {
    return { error: "Este usuario no está vinculado a una empresa", status: 404 as const }
  }
  if (payload.empresaId && payload.empresaId !== usuario.empresaId) {
    return { error: "La sesión no corresponde a la empresa del usuario", status: 403 as const }
  }
  return { usuario, empresa: usuario.empresa }
}
