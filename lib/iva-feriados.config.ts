// lib/iva-feriados.config.ts
// Catálogo oculto de Feriados con IVA reducido 8% - SRI Código 4
// Para cualquier negocio: chifa, restaurante, bar, hotel

export interface FeriadoIva {
  nombre: string
  inicio: string // YYYY-MM-DD
  fin: string
  tasaIva: number
  codigoSri: string // '4' para feriado 8%, '2' para normal 15%, '0' para exento
  decreto: string
}

export const feriadosIvaReducido: FeriadoIva[] = [
  { 
    nombre: "Feriado Difuntos / Independencia Cuenca", 
    inicio: "2026-11-01", 
    fin: "2026-11-04", 
    tasaIva: 0.08, 
    codigoSri: "4", 
    decreto: "Decreto 123 - IVA 8% Sector Turístico" 
  },
  { 
    nombre: "Carnaval 2027", 
    inicio: "2027-02-14", 
    fin: "2027-02-17", 
    tasaIva: 0.08, 
    codigoSri: "4", 
    decreto: "Decreto Carnaval - IVA 8%" 
  },
  { 
    nombre: "Semana Santa 2027", 
    inicio: "2027-04-02", 
    fin: "2027-04-04", 
    tasaIva: 0.08, 
    codigoSri: "4", 
    decreto: "Decreto Semana Santa - IVA 8%" 
  },
]