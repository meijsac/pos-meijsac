export type PermisosPos = {
  descuento: boolean
  limiteDescuento: number
  modificarPrecio: boolean
  anulaciones: boolean
  obligarApertura: boolean
  reaperturaCaja: boolean
  verCostos: boolean
  verReportes: boolean
  modificarSecuenciales: boolean
  verHistoriaClinica: boolean
}

export function permisosNormales(valor: unknown): PermisosPos {
  const fila = valor && typeof valor === "object" ? valor as Record<string, unknown> : {}
  const limite = Number(fila.limiteDescuento)
  return {
    descuento: !!fila.descuento,
    limiteDescuento: Number.isFinite(limite) ? Math.min(100, Math.max(0, limite)) : 5,
    modificarPrecio: !!fila.modificarPrecio,
    anulaciones: !!fila.anulaciones,
    obligarApertura: fila.obligarApertura !== false,
    reaperturaCaja: !!fila.reaperturaCaja,
    verCostos: !!fila.verCostos,
    verReportes: !!fila.verReportes,
    modificarSecuenciales: !!fila.modificarSecuenciales,
    verHistoriaClinica: !!fila.verHistoriaClinica,
  }
}

export function permisosDeUsuario(usuario: { rol?: string; permisos?: unknown } | null | undefined) {
  if (!usuario) return null
  if (String(usuario.rol || "").toUpperCase() === "ADMIN") return null
  return permisosNormales(usuario.permisos)
}

export function permisosLocales() {
  if (typeof window === "undefined") return null
  try {
    const usuario = JSON.parse(localStorage.getItem("meijsac_user") || "null")
    return permisosDeUsuario(usuario)
  } catch {
    return null
  }
}

export function rutaPermitida(ruta: string, permisos: PermisosPos | null) {
  if (!permisos) return true
  if (ruta === "/dashboard") return permisos.verReportes
  if (ruta.startsWith("/dashboard/configuracion")) return permisos.modificarSecuenciales
  if (ruta.startsWith("/dashboard/reportes") || ruta.startsWith("/dashboard/contabilidad") || ruta.startsWith("/dashboard/cxc") || ruta.startsWith("/dashboard/respaldo")) return permisos.verReportes
  if (ruta.startsWith("/dashboard/productos")) return permisos.verCostos
  if (ruta.startsWith("/dashboard/nota-credito")) return permisos.anulaciones
  if (ruta.startsWith("/dashboard/comprobantes-adicionales/opticas/historia-clinica")) return permisos.verHistoriaClinica
  return true
}
