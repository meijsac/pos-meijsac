/** Cédula de 10 dígitos dentro de un RUC o de un serial de firma (IDCEC-1708330509). */
export function cedulaBase(valor: unknown) {
  const limpio = String(valor || "").replace(/IDCEC/gi, "").replace(/-/g, "")
  return limpio.replace(/\D/g, "").slice(0, 10)
}

/**
 * El .p12 de una persona natural trae la cédula (1708330509) o IDCEC-1708330509.
 * El RUC de la empresa es esa cédula más 001 (1708330509001). No se exige el mismo texto.
 * Si el certificado no trae un identificador claro, no se bloquea: el SRI comprueba el vínculo al recibir el XML.
 */
export function firmaCoincideConEmpresa(idFirma: unknown, rucEmpresa: unknown) {
  const texto = String(idFirma || "")
  const ruc = String(rucEmpresa || "").replace(/\D/g, "")
  const base = ruc.slice(0, 10)
  if (base.length < 10) return true
  const digitos = texto.replace(/\D/g, "")
  if (digitos.length < 10) return true
  if (digitos.includes(base) || ruc.includes(digitos.slice(0, 10))) return true
  const grupos = texto.match(/\d{10,13}/g) || []
  return grupos.some((grupo) => grupo.slice(0, 10) === base || ruc.includes(grupo.slice(0, 10)))
}
