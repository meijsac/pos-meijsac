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
}

export async function cargarEmpresaSesion() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch("/api/empresa/mia", { signal: ctrl.signal })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "No se pudo cargar la empresa")
    if (!data.empresa?.ruc) throw new Error("La sesión no trajo una empresa")
    guardarEmpresaLocal(data.empresa)
    return data.empresa
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Tiempo agotado al cargar la empresa")
    throw e
  } finally {
    clearTimeout(timer)
  }
}
