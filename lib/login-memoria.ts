import type { IntentoLogin } from "@/lib/seguridad"

const intentos: IntentoLogin[] = []
const whatsapp = new Map<string, { fechas: number[]; bloqueadoHasta: number }>()
const facturasCaja = new Map<string, number[]>()
const sesionesVivas = new Map<string, number>()

export function anotarIntento(item: IntentoLogin) {
  intentos.push(item)
  const corte = Date.now() - 60 * 60 * 1000
  while (intentos.length && intentos[0].fecha < corte) intentos.shift()
  return intentos
}

export function leerIntentos() {
  return intentos
}

export function abrirSesion(id: string) {
  sesionesVivas.set(id, Date.now())
}

export function cerrarSesion(id: string) {
  sesionesVivas.delete(id)
}

export function sesionViva(id: string) {
  const ultima = sesionesVivas.get(id)
  if (!ultima) return false
  if (Date.now() - ultima > 8 * 60 * 60 * 1000) {
    sesionesVivas.delete(id)
    return false
  }
  sesionesVivas.set(id, Date.now())
  return true
}

export function cerrarSesiones() {
  sesionesVivas.clear()
}

export function anotarWhatsapp(numero: string, ahora: number) {
  const actual = whatsapp.get(numero) || { fechas: [], bloqueadoHasta: 0 }
  actual.fechas = actual.fechas.filter((f) => ahora - f < 60 * 60 * 1000)
  actual.fechas.push(ahora)
  whatsapp.set(numero, actual)
  return actual
}

export function estadoWhatsapp(numero: string) {
  return whatsapp.get(numero) || { fechas: [], bloqueadoHasta: 0 }
}

export function bloquearWhatsapp(numero: string, hasta: number) {
  const actual = estadoWhatsapp(numero)
  actual.bloqueadoHasta = hasta
  whatsapp.set(numero, actual)
}

export function anotarFacturaCaja(caja: string, ahora: number) {
  const previas = (facturasCaja.get(caja) || []).filter((f) => ahora - f < 60_000)
  previas.push(ahora)
  facturasCaja.set(caja, previas)
  return previas.length
}
