export function digitoModulo11(cadena48: string) {
  let factor = 2
  let suma = 0
  for (let i = cadena48.length - 1; i >= 0; i--) {
    suma += Number(cadena48[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const digito = 11 - (suma % 11)
  if (digito === 11) return "0"
  if (digito === 10) return "1"
  return String(digito)
}

export function claveAcceso49(partes: {
  fecha: string
  tipoComprobante?: string
  ruc: string
  ambiente: string
  establecimiento: string
  puntoEmision: string
  secuencial: string
  codigoNumerico?: string
  tipoEmision?: string
}) {
  const fecha = partes.fecha.replace(/\D/g, "").padStart(8, "0").slice(-8)
  const tipo = (partes.tipoComprobante || "01").replace(/\D/g, "").padStart(2, "0").slice(-2)
  const ruc = partes.ruc.replace(/\D/g, "")
  const ambiente = partes.ambiente === "2" ? "2" : "1"
  const estab = partes.establecimiento.replace(/\D/g, "").padStart(3, "0").slice(-3)
  const pto = partes.puntoEmision.replace(/\D/g, "").padStart(3, "0").slice(-3)
  const secuencial = partes.secuencial.replace(/\D/g, "").padStart(9, "0").slice(-9)
  const codigo = (partes.codigoNumerico || String(Math.floor(Math.random() * 100000000))).replace(/\D/g, "").padStart(8, "0").slice(-8)
  const emision = partes.tipoEmision === "2" ? "2" : "1"
  const base = `${fecha}${tipo}${ruc}${ambiente}${estab}${pto}${secuencial}${codigo}${emision}`
  if (base.length !== 48) throw new Error(`La clave de acceso quedó en ${base.length} dígitos. El RUC debe tener 13.`)
  return base + digitoModulo11(base)
}
