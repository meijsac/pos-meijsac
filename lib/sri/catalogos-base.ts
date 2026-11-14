export const TARIFAS_IVA_BASE: Record<string, number> = {
  "0": 0,
  "2": 12,
  "3": 14,
  "4": 15,
  "5": 5,
  "6": 0,
  "7": 0,
  "8": 8,
  "10": 13,
}

export type FilaCatalogo = {
  grupo: "IVA" | "RETENCION_RENTA" | "RETENCION_IVA"
  codigo: string
  descripcion: string
  porcentaje: number
}

export const SEMILLA_CATALOGOS: FilaCatalogo[] = [
  { grupo: "IVA", codigo: "0", descripcion: "0%", porcentaje: 0 },
  { grupo: "IVA", codigo: "2", descripcion: "12%", porcentaje: 12 },
  { grupo: "IVA", codigo: "3", descripcion: "14%", porcentaje: 14 },
  { grupo: "IVA", codigo: "4", descripcion: "15%", porcentaje: 15 },
  { grupo: "IVA", codigo: "5", descripcion: "5%", porcentaje: 5 },
  { grupo: "IVA", codigo: "6", descripcion: "No objeto de IVA", porcentaje: 0 },
  { grupo: "IVA", codigo: "7", descripcion: "Exento de IVA", porcentaje: 0 },
  { grupo: "IVA", codigo: "8", descripcion: "8%", porcentaje: 8 },
  { grupo: "IVA", codigo: "10", descripcion: "13%", porcentaje: 13 },
  { grupo: "RETENCION_RENTA", codigo: "312", descripcion: "312 - Transferencia bienes 1.75%", porcentaje: 1.75 },
  { grupo: "RETENCION_RENTA", codigo: "343", descripcion: "343 - RIMPE Emprendedor 1%", porcentaje: 1 },
  { grupo: "RETENCION_RENTA", codigo: "310", descripcion: "310 - Honorarios profesionales 8%", porcentaje: 8 },
  { grupo: "RETENCION_RENTA", codigo: "303", descripcion: "303 - Servicios predomina intelecto 8%", porcentaje: 8 },
  { grupo: "RETENCION_RENTA", codigo: "332", descripcion: "332 - Compra bienes no prod por soc. 2.75%", porcentaje: 2.75 },
  { grupo: "RETENCION_IVA", codigo: "1", descripcion: "30% Bienes", porcentaje: 30 },
  { grupo: "RETENCION_IVA", codigo: "2", descripcion: "70% Servicios", porcentaje: 70 },
  { grupo: "RETENCION_IVA", codigo: "3", descripcion: "100% - Honorarios / Liquidación", porcentaje: 100 },
]

let tarifasVigentes: Record<string, number> = { ...TARIFAS_IVA_BASE }

export function tarifasEnMemoria() {
  return tarifasVigentes
}

export function publicarTarifas(mapa: Record<string, number>) {
  tarifasVigentes = { ...TARIFAS_IVA_BASE, ...mapa }
}
