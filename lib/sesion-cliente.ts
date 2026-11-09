const MARCA = "meijsac_empresa_ok"
let refresco: Promise<any | null> | null = null

export function guardarEmpresaLocal(empresa: any, token?: string, usuario?: any) {
  if (typeof window === "undefined" || !empresa) return
  localStorage.removeItem("meijsac_token")
  void token
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
