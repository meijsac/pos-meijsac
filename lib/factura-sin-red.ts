const CLAVE = "meijsac_facturas_sin_red"

type Pendiente = { colaId: string; body: Record<string, unknown>; error?: string }

function leer(): Pendiente[] {
  if (typeof window === "undefined") return []
  try {
    const data = JSON.parse(localStorage.getItem(CLAVE) || "[]")
    return Array.isArray(data) ? data.filter((item) => item && item.colaId && item.body) : []
  } catch {
    return []
  }
}

function guardar(lista: Pendiente[]) {
  localStorage.setItem(CLAVE, JSON.stringify(lista))
}

export function encolarFacturaSinRed(body: Record<string, unknown>) {
  const colaId = String(body.colaId || "")
  if (!colaId) return
  const lista = leer()
  if (lista.some((item) => item.colaId === colaId)) return
  lista.push({ colaId, body: { ...body, colaId, estadoSRI: "PENDIENTE", diferirSri: true } })
  guardar(lista)
}

export async function enviarFacturasSinRed() {
  if (typeof window === "undefined" || !navigator.onLine) return { enviadas: 0, pendientes: leer().length }
  const lista = leer()
  const quedan: Pendiente[] = []
  let enviadas = 0
  let cortar = false
  for (const item of lista) {
    if (cortar || item.error) {
      quedan.push(item)
      continue
    }
    try {
      const res = await fetch("/api/facturar", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}`,
        },
        body: JSON.stringify(item.body),
      })
      if (res.ok) {
        enviadas += 1
        continue
      }
      if (res.status === 401 || res.status === 429 || res.status >= 500) {
        quedan.push(item)
        cortar = true
        continue
      }
      const data = await res.json().catch(() => ({}))
      quedan.push({ ...item, error: String(data.error || "No se pudo emitir") })
    } catch {
      quedan.push(item)
      cortar = true
    }
  }
  guardar(quedan)
  return { enviadas, pendientes: quedan.length }
}
