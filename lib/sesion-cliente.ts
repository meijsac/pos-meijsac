export function guardarEmpresaLocal(empresa: any, token?: string, usuario?: any) {
  if (typeof window === "undefined" || !empresa) return
  if (token) localStorage.setItem("meijsac_token", token)
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
  const token = localStorage.getItem("meijsac_token") || ""
  if (!token || token === "ok" || token.startsWith("ok-") || token === "demo") {
    throw new Error("No hay sesión. Vuelve a entrar.")
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch("/api/empresa/mia", {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
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
