import jwt from "jsonwebtoken"
import type { Empresa, Usuario } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { abrirSesion } from "@/lib/login-memoria"

export function secretoJwt() {
  const secreto = process.env.JWT_SECRET || ""
  if (!secreto) throw new Error("JWT_SECRET no configurado")
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
    ambiente: String(empresa.ambienteSri || extra.ambienteCodigo || extra.ambiente || ""),
    firmaExpira: empresa.firmaExpira ? empresa.firmaExpira.toISOString() : "",
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

const UNA_HORA_SEG = 60 * 60
const UNA_HORA_MS = UNA_HORA_SEG * 1000

export function firmarSesion(usuario: { id: string; empresaId: string; sid: string; ip: string; ua: string }, dias?: "7d") {
  return jwt.sign(
    { id: usuario.id, empresaId: usuario.empresaId, sid: usuario.sid, ip: usuario.ip, ua: usuario.ua },
    secretoJwt(),
    { expiresIn: dias || "1h" }
  )
}

export function tokensDeCabeceras(cookie: string, authorization = "") {
  const tokens: string[] = []
  for (const parte of cookie.split(";")) {
    const item = parte.trim()
    if (!item.startsWith("meijsac_sesion=")) continue
    const crudo = item.slice("meijsac_sesion=".length)
    try { tokens.push(decodeURIComponent(crudo)) } catch { tokens.push(crudo) }
  }
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (bearer && bearer !== "ok" && !bearer.startsWith("ok-") && bearer !== "demo" && !tokens.includes(bearer)) tokens.push(bearer)
  return tokens.filter(Boolean)
}

export function sesionEstaVencida(fila: { revocada: boolean; expira: Date; updatedAt: Date } | null, ahora = Date.now()) {
  if (!fila) return false
  if (fila.revocada) return true
  if (new Date(fila.expira).getTime() <= ahora) return true
  const toque = new Date(fila.updatedAt).getTime()
  if (Number.isFinite(toque) && ahora - toque >= UNA_HORA_MS) return true
  return false
}

export function cookiesSesion(acceso: string, refresh: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return [
    `meijsac_sesion=${encodeURIComponent(acceso)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${UNA_HORA_SEG}${secure}`,
    `meijsac_refresh=${encodeURIComponent(refresh)}; HttpOnly; Path=/api/auth; SameSite=Lax; Max-Age=${UNA_HORA_SEG}${secure}`,
  ]
}

export function cookiesCerradas() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  const bases = [
    "meijsac_sesion=; HttpOnly; Path=/; Max-Age=0",
    "meijsac_refresh=; HttpOnly; Path=/api/auth; Max-Age=0",
  ]
  return bases.flatMap((base) => ["", "; SameSite=Lax", "; SameSite=Strict"].map((site) => `${base}${site}${secure}`))
}

export async function usuarioConEmpresaDesdeRequest(req: Request) {
  const tokens = tokensDeCabeceras(req.headers.get("cookie") || "", req.headers.get("authorization") || "")
  if (!tokens.length) return { error: "No hay sesión. Vuelve a entrar.", status: 401 as const }
  let payload: { id?: string; empresaId?: string; sid?: string; ip?: string; ua?: string } | null = null
  for (const token of tokens) {
    let dato: { id?: string; empresaId?: string; sid?: string; ip?: string; ua?: string }
    try {
      dato = jwt.verify(token, secretoJwt()) as { id?: string; empresaId?: string; sid?: string; ip?: string; ua?: string }
    } catch { continue }
    if (!dato.id || !dato.sid) continue
    try {
      const fila = await prisma.sesionUsuario.findUnique({ where: { id: dato.sid } })
      if (sesionEstaVencida(fila)) continue
      if (!fila) {
        await prisma.sesionUsuario.create({
          data: {
            id: dato.sid,
            usuarioId: dato.id,
            expira: new Date(Date.now() + UNA_HORA_MS),
            ip: dato.ip || "",
            navegador: (dato.ua || "").slice(0, 180),
          },
        }).catch(() => {})
      } else {
        await prisma.sesionUsuario.update({ where: { id: dato.sid }, data: { updatedAt: new Date() } }).catch(() => {})
      }
    } catch { /* el JWT firmado sigue valiendo si la base no responde */ }
    payload = dato
    break
  }
  if (!payload?.id || !payload.sid) return { error: "Sesión vencida. Vuelve a entrar.", status: 401 as const }
  abrirSesion(payload.sid)

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
  await prisma.empresaUsuario.upsert({
    where: { empresaId_userId: { empresaId: usuario.empresaId, userId: usuario.id } },
    update: { rol: usuario.rol },
    create: { empresaId: usuario.empresaId, userId: usuario.id, rol: usuario.rol },
  }).catch(() => {})
  const tokenSupabase = req.headers.get("x-supabase-access-token") || ""
  if (tokenSupabase) {
    const url = process.env.SUPABASE_URL || ""
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    if (!url || !key) return { error: "Falta Supabase Auth en el servidor", status: 503 as const }
    const { createClient } = await import("@supabase/supabase-js")
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await supabase.auth.getUser(tokenSupabase)
    if (error || !data.user) return { error: "Sesión de Supabase inválida", status: 401 as const }
    const miembro = await prisma.empresaUsuario.findFirst({ where: { empresaId: usuario.empresaId, userId: data.user.id } })
    if (!miembro) return { error: "El usuario no pertenece a esta empresa", status: 403 as const }
  }
  return { usuario, empresa: usuario.empresa }
}
