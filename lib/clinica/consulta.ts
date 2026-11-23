import { Prisma } from "@prisma/client"

export const TEXTO_DATOS_CLINICA = "Autorizo el uso de mis datos de salud para la historia clínica de este establecimiento, conforme a la Ley Orgánica de Protección de Datos Personales."

export function texto(valor: unknown, tope = 500) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, tope)
}

export function plantillaDe(valor: unknown) {
  const nombre = texto(valor, 20)
  if (nombre === "ginecologia" || nombre === "pediatria") return nombre
  return "general"
}

function objeto(valor: unknown) {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {}
}

function lista(valor: unknown, tope: number) {
  return Array.isArray(valor) ? valor.slice(0, tope) : []
}

export function sanearConsulta(body: Record<string, unknown>) {
  const signos = objeto(body.signos)
  const especialidad = objeto(body.especialidad)
  const diagnosticos = lista(body.diagnosticos, 12).map((item) => {
    const fila = objeto(item)
    const tipo = texto(fila.tipo, 12) === "Presuntivo" ? "Presuntivo" : "Definitivo"
    return { codigo: texto(fila.codigo, 8).toUpperCase(), nombre: texto(fila.nombre, 160), tipo }
  }).filter((item) => item.codigo && item.nombre)
  const ordenes = lista(body.ordenes, 20).map((item) => {
    const fila = objeto(item)
    const clase = texto(fila.clase, 12) === "lab" ? "lab" : "imagen"
    return { clase, nombre: texto(fila.nombre, 120), estado: texto(fila.estado, 40) || "Solicitado" }
  }).filter((item) => item.nombre)
  const receta = lista(body.receta, 16).map((item) => {
    const fila = objeto(item)
    return {
      generico: texto(fila.generico, 120),
      comercial: texto(fila.comercial, 120),
      concentracion: texto(fila.concentracion, 40),
      forma: texto(fila.forma, 40),
      cantidad: texto(fila.cantidad, 8),
      cantidadLetras: texto(fila.cantidadLetras, 40),
      dosis: texto(fila.dosis, 80),
      via: texto(fila.via, 40),
      frecuencia: texto(fila.frecuencia, 80),
      duracion: texto(fila.duracion, 80),
      alarma: texto(fila.alarma, 160),
    }
  }).filter((item) => item.generico)
  return {
    plantilla: plantillaDe(body.plantilla),
    motivo: texto(body.motivo, 240),
    enfermedad: texto(body.enfermedad, 2000),
    antecedentes: texto(body.antecedentes, 2000),
    examenFisico: texto(body.examenFisico, 2000),
    signos: {
      pa: texto(signos.pa, 16),
      fc: texto(signos.fc, 16),
      fr: texto(signos.fr, 16),
      temp: texto(signos.temp, 8),
      spo2: texto(signos.spo2, 8),
      peso: texto(signos.peso, 8),
      talla: texto(signos.talla, 8),
    },
    especialidad: Object.fromEntries(Object.entries(especialidad).slice(0, 16).map(([clave, valor]) => [texto(clave, 30), texto(valor, 120)])),
    diagnosticos,
    ordenes,
    receta,
  }
}

export function jsonConsulta(data: ReturnType<typeof sanearConsulta>): Prisma.ClinicaConsultaUpdateInput {
  return {
    plantilla: data.plantilla,
    motivo: data.motivo,
    enfermedad: data.enfermedad,
    antecedentes: data.antecedentes,
    examenFisico: data.examenFisico,
    signos: data.signos,
    especialidad: data.especialidad,
    diagnosticos: data.diagnosticos,
    ordenes: data.ordenes,
    receta: data.receta,
  }
}
