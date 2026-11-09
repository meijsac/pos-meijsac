/** Cédula de 10 dígitos dentro de un RUC o de un serial de firma (IDCEC-1708330509). */
export function cedulaBase(valor: unknown) {
  const limpio = String(valor || "").replace(/IDCEC/gi, "").replace(/-/g, "")
  return limpio.replace(/\D/g, "").slice(0, 10)
}

/**
 * Persona natural: RUC = cédula + 001.
 * Coincide si los primeros 10 dígitos son iguales.
 * Si falta uno de los dos, no se marca como distinta: el SRI valida el vínculo al recibir el XML.
 */
export function firmaCoincideConEmpresa(idFirma: unknown, rucEmpresa: unknown) {
  const cedulaFirma = cedulaBase(idFirma)
  const cedulaRuc = cedulaBase(rucEmpresa)
  if (cedulaFirma.length < 10 || cedulaRuc.length < 10) return true
  return cedulaFirma === cedulaRuc
}
