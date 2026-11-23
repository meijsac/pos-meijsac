export type EstadoRestaurante = {
  mesas: unknown[]
  tickets: unknown[]
  menu: unknown[]
  categorias: unknown[]
  updatedAt: string
}

export function nombreUsuario() {
  try {
    const usuario = JSON.parse(localStorage.getItem("meijsac_user") || "{}")
    return String(usuario?.nombre || "").trim()
  } catch {
    return ""
  }
}

export function sonarListo() {
  try {
    const audio = new AudioContext()
    const osc = audio.createOscillator()
    const ganancia = audio.createGain()
    osc.type = "sine"
    osc.frequency.value = 880
    ganancia.gain.value = 0.08
    osc.connect(ganancia)
    ganancia.connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + 0.18)
    osc.onended = () => { void audio.close() }
  } catch {}
  if (navigator.vibrate) navigator.vibrate([180, 80, 180])
}

export async function leerRestaurante(): Promise<EstadoRestaurante | null> {
  const res = await fetch("/api/restaurante/estado", { credentials: "same-origin", signal: AbortSignal.timeout(8000) }).catch(() => null)
  if (!res?.ok) return null
  const data = await res.json().catch(() => null)
  if (!data || typeof data !== "object") return null
  return {
    mesas: Array.isArray(data.mesas) ? data.mesas : [],
    tickets: Array.isArray(data.tickets) ? data.tickets : [],
    menu: Array.isArray(data.menu) ? data.menu : [],
    categorias: Array.isArray(data.categorias) ? data.categorias : [],
    updatedAt: String(data.updatedAt || ""),
  }
}

export async function guardarRestaurante(parte: Partial<Pick<EstadoRestaurante, "mesas" | "tickets" | "menu" | "categorias">> & { reemplazarTickets?: boolean }) {
  const res = await fetch("/api/restaurante/estado", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parte),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)
  return Boolean(res?.ok)
}

export function leerLocal(clave: string) {
  try {
    const data = JSON.parse(localStorage.getItem(clave) || "[]")
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
