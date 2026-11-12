export async function emisionBloqueada(ruc: string) {
  if (!ruc) return null
  try {
    const res = await fetch(`/api/empresa/estado?ruc=${encodeURIComponent(ruc)}`, { cache: "no-store", credentials: "same-origin" })
    if (!res.ok) return null
    const data = await res.json()
    if (data.planEstado === "ACTIVO") return null
    if (data.estado === "BLOQUEADO") return data.mensaje || "Plan bloqueado"
    return null
  } catch {
    return null
  }
}

export async function contarComprobante(ruc: string) {
  if (!ruc) return
  try {
    await fetch("/api/empresa/consumo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruc }),
    })
  } catch {
    /* la venta local no depende de este conteo si no hay red */
  }
}

export function rucLocal() {
  try {
    const empresa = JSON.parse(localStorage.getItem("meijsac_empresa") || "{}")
    const cfg = JSON.parse(localStorage.getItem("meijsac_config_pro") || "{}")
    return String(empresa.ruc || cfg.ruc || "")
  } catch {
    return ""
  }
}
