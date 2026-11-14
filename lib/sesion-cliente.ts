const MARCA = "meijsac_empresa_ok"
let refresco: Promise<any | null> | null = null

const CLAVES_DE_EMPRESA = [
  "meijsac_clientes",
  "meijsac_compras_ats",
  "meijsac_compras_ats_v2",
  "meijsac_comprobantes_sri",
  "meijsac_comprobantes_emitidos",
  "meijsac_documentos_emitidos",
  "meijsac_facturas",
  "meijsac_ventas_pos",
  "meijsac_restaurante_facturas",
  "meijsac_enviados_sri",
  "meijsac_comprobantes_pendientes_sri",
  "meijsac_retenciones",
  "meijsac_borradores_facturas",
  "meijsac_cxc",
  "meijsac_productos",
  "catalogo_rapido_meijsac",
  "meijsac_facturas_emitidas",
  "meijsac_autorizados",
  "meijsac_emitidos",
  "meijsac_guias_06",
  "meijsac_liquidaciones_03",
  "meijsac_config_pro",
  "meijsac_contador_secuencial",
  "meijsac_ultima_factura_pendiente",
]

export function limpiarDatosDeEmpresa() {
  if (typeof window === "undefined") return
  CLAVES_DE_EMPRESA.forEach((clave) => localStorage.removeItem(clave))
  const borrar: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const clave = localStorage.key(i) || ""
    if (clave.startsWith("productos_") || clave.startsWith("bodegas_") || clave.startsWith("catalogo_rapido_")) borrar.push(clave)
  }
  borrar.forEach((clave) => localStorage.removeItem(clave))
}

export function guardarEmpresaLocal(empresa: any, token?: string, usuario?: any) {
  if (typeof window === "undefined" || !empresa) return
  void token
  const previa = leerEmpresaLocal()
  const idNuevo = String(empresa.id || empresa.empresaId || "")
  const idPrevio = String(previa?.id || previa?.empresaId || "")
  if (idNuevo && idPrevio && idNuevo !== idPrevio) limpiarDatosDeEmpresa()
  localStorage.setItem("meijsac_empresa", JSON.stringify(empresa))
  localStorage.setItem("meijsac_registro", JSON.stringify(empresa))
  localStorage.setItem(
    "meijsac_user",
    JSON.stringify(
      usuario || {
        nombre: empresa.usuario,
        empresa: empresa.razonSocial,
        rol: empresa.rol,
        ruc: empresa.ruc,
        empresaId: empresa.id,
      }
    )
  )
  sessionStorage.setItem(MARCA, "1")
}

export function leerEmpresaLocal() {
  if (typeof window === "undefined") return null
  try {
    const empresa = JSON.parse(localStorage.getItem("meijsac_empresa") || "null")
    if (!empresa || typeof empresa !== "object") return null
    if (!empresa.ruc && !empresa.razonSocial && !empresa.razon) return null
    return empresa
  } catch {
    return null
  }
}

function pedirEmpresaUnaVez() {
  if (refresco) return refresco
  if (typeof window !== "undefined" && sessionStorage.getItem(MARCA) === "1") {
    refresco = Promise.resolve(leerEmpresaLocal())
    return refresco
  }
  refresco = (async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    try {
      const res = await fetch("/api/empresa/mia", { signal: ctrl.signal })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.empresa?.ruc) return leerEmpresaLocal()
      guardarEmpresaLocal(data.empresa)
      return data.empresa
    } catch {
      return leerEmpresaLocal()
    } finally {
      clearTimeout(timer)
    }
  })()
  return refresco
}

export function limpiarSesionLocal() {
  if (typeof window === "undefined") return
  localStorage.removeItem("meijsac_user")
  localStorage.removeItem("meijsac_empresa")
  localStorage.removeItem("meijsac_registro")
  localStorage.removeItem("meijsac_token")
  localStorage.removeItem("empresaId")
  localStorage.removeItem("empresa_id")
  localStorage.removeItem("empresa")
  limpiarDatosDeEmpresa()
  sessionStorage.removeItem(MARCA)
  sessionStorage.removeItem("meijsac_acceso_ok")
}

export async function cerrarSesionEnEsteEquipo() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {})
  limpiarSesionLocal()
  sessionStorage.removeItem("meijsac_aviso_sesion")
  window.location.href = "/login"
}

export async function cargarEmpresaSesion() {
  const local = leerEmpresaLocal()
  if (local) {
    void pedirEmpresaUnaVez()
    return local
  }
  const fresco = await pedirEmpresaUnaVez()
  if (fresco?.ruc || fresco?.razonSocial || fresco?.razon) return fresco
  throw new Error("No se pudo cargar la empresa")
}
