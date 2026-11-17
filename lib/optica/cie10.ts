export const CIE10_OPTICA = [
  { codigo: "H52.0", descripcion: "Hipermetropía" },
  { codigo: "H52.1", descripcion: "Miopía" },
  { codigo: "H52.2", descripcion: "Astigmatismo" },
  { codigo: "H52.3", descripcion: "Anisometropía y aniseiconía" },
  { codigo: "H52.4", descripcion: "Presbicia" },
  { codigo: "H52.5", descripcion: "Trastornos de la acomodación" },
  { codigo: "H52.6", descripcion: "Otros trastornos de la refracción" },
  { codigo: "H52.7", descripcion: "Trastorno de la refracción, no especificado" },
  { codigo: "H53.0", descripcion: "Ambliopía ex anopsia" },
  { codigo: "H53.1", descripcion: "Trastornos visuales subjetivos" },
  { codigo: "H53.2", descripcion: "Diplopía" },
  { codigo: "H53.8", descripcion: "Otros trastornos visuales" },
  { codigo: "H53.9", descripcion: "Trastorno visual, no especificado" },
  { codigo: "H10.9", descripcion: "Conjuntivitis, no especificada" },
  { codigo: "H04.1", descripcion: "Otros trastornos de la glándula lagrimal" },
  { codigo: "H16.9", descripcion: "Queratitis, no especificada" },
  { codigo: "H25.9", descripcion: "Catarata senil, no especificada" },
  { codigo: "H40.9", descripcion: "Glaucoma, no especificado" },
  { codigo: "H35.3", descripcion: "Degeneración de la mácula y del polo posterior" },
]

export function diagnosticoCie(codigo: string) {
  const limpio = String(codigo || "").trim().toUpperCase()
  return CIE10_OPTICA.find((fila) => fila.codigo.toUpperCase() === limpio) || null
}
