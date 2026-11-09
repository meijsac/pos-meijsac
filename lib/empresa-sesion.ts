import jwt from "jsonwebtoken"
import type { Empresa, Usuario } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const JWT_SECRET = "MEIJSAC_SECRET_2026"

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
    logoUrl: String(extra.logo_url || extra.logoUrl || ""),
    logo_url: String(extra.logo_url || extra.logoUrl || ""),
    actividad: String(extra.actividad || ""),
    obligado,
    obligadoConta: obligado,
    contribuyenteEspecial: String(extra.contribuyenteEspecial || ""),
    tipoContribuyente: String(extra.tipoContribuyente || ""),
    sector: String(extra.sector || ""),
    celular: String(extra.celular || ""),
    respNombre: String(extra.respNombre || ""),
    respCelular: String(extra.respCelular || ""),
    usuario: usuario.nombre,
    rol: usuario.rol,
  }
}

export function firmarSesion(usuario: { id: string; empresaId: string }) {
  return jwt.sign({ id: usuario.id, empresaId: usuario.empresaId }, JWT_SECRET, { expiresIn: "8h" })
}

export async function usuarioConEmpresaDesdeRequest(req: Request) {
  const header = req.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!token || token === "ok" || token.startsWith("ok-") || token === "demo" || token === "offline-token-demo") {
    return { error: "No hay sesión. Vuelve a entrar.", status: 401 as const }
  }
  let payload: { id?: string; empresaId?: string }
  try {
    payload = jwt.verify(token, JWT_SECRET) as { id?: string; empresaId?: string }
  } catch {
    return { error: "Sesión vencida. Vuelve a entrar.", status: 401 as const }
  }
  if (!payload.id) return { error: "Sesión inválida", status: 401 as const }

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
