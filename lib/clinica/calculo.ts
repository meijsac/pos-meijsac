export function edadDesde(fecha: string | Date | null | undefined) {
  if (!fecha) return ""
  const nace = new Date(fecha)
  if (Number.isNaN(nace.getTime())) return ""
  const hoy = new Date()
  let anios = hoy.getFullYear() - nace.getFullYear()
  const mes = hoy.getMonth() - nace.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nace.getDate())) anios -= 1
  if (anios < 0 || anios > 120) return ""
  return `${anios} años`
}

export function imcDe(peso: unknown, tallaCm: unknown) {
  const kg = Number(peso)
  const cm = Number(tallaCm)
  if (!Number.isFinite(kg) || !Number.isFinite(cm) || kg <= 0 || cm <= 0) return null
  const metros = cm / 100
  const valor = kg / (metros * metros)
  if (!Number.isFinite(valor) || valor > 80) return null
  return Math.round(valor * 100) / 100
}

export function bandaImcAdulto(imc: number) {
  if (imc < 18.5) return "Bajo"
  if (imc < 25) return "Normal"
  if (imc < 30) return "Sobrepeso"
  return "Obesidad"
}

export function fppDesde(fum: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fum)) return ""
  const fecha = new Date(`${fum}T00:00:00`)
  if (Number.isNaN(fecha.getTime())) return ""
  fecha.setDate(fecha.getDate() + 280)
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function semanasDesde(fum: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fum)) return ""
  const inicio = new Date(`${fum}T00:00:00`)
  if (Number.isNaN(inicio.getTime())) return ""
  const dias = Math.floor((Date.now() - inicio.getTime()) / 86400000)
  if (dias < 0 || dias > 320) return ""
  const semanas = Math.floor(dias / 7)
  const resto = dias % 7
  return `${semanas} sem ${resto} d`
}

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]
const ESPECIALES = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"]
const DECENAS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]

export function cantidadEnLetras(valor: unknown) {
  const n = Math.round(Number(valor))
  if (!Number.isFinite(n) || n < 0 || n > 99) return ""
  if (n === 0) return "cero"
  if (n < 10) return UNIDADES[n]
  if (n < 20) return ESPECIALES[n - 10]
  if (n === 20) return "veinte"
  if (n < 30) return `veinti${UNIDADES[n - 20]}`
  const decena = DECENAS[Math.floor(n / 10)]
  const unidad = n % 10
  return unidad ? `${decena} y ${UNIDADES[unidad]}` : decena
}
