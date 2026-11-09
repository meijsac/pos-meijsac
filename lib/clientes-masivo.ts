export const COLUMNAS_CLIENTE = [
  "tipo_identificacion",
  "identificacion",
  "nombre_razon_social",
  "email",
  "telefono",
  "direccion",
  "ciudad",
  "es_cliente_frecuente",
] as const

export const EJEMPLOS_CLIENTE = [
  ["CEDULA", "1708330509", "María Pérez", "maria@gmail.com", "0999999999", "Av. Amazonas 123", "Quito", "SI"],
  ["RUC", "1793243789001", "MEIJSAC S.A.S.", "ventas@meijisac.com", "022222222", "Av. 6 de Diciembre", "Quito", "SI"],
  ["PASAPORTE", "AB123456", "John Smith", "john@gmail.com", "0987654321", "Calle Falsa 123", "Quito", "NO"],
]

const TIPOS = new Set(["CEDULA", "RUC", "PASAPORTE", "CONSUMIDOR FINAL"])

export type FilaCliente = {
  tipo_identificacion: string
  identificacion: string
  nombre_razon_social: string
  email: string
  telefono: string
  direccion: string
  ciudad: string
  es_cliente_frecuente: string
}

export type FilaRevisada = {
  numero: number
  datos: FilaCliente
  errores: string[]
}

export function textoCelda(valor: unknown): string {
  if (valor == null) return ""
  if (typeof valor === "number") return Number.isSafeInteger(valor) ? String(valor) : String(valor)
  if (typeof valor === "object") {
    const dato = valor as { text?: unknown; result?: unknown; richText?: { text: string }[] }
    if (Array.isArray(dato.richText)) return dato.richText.map((p) => p.text).join("").trim()
    if (dato.result != null) return textoCelda(dato.result)
    if (dato.text != null) return String(dato.text).trim()
  }
  return String(valor).trim()
}

export function normalizarTipo(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

export function validarCedulaEC(ced: string) {
  if (!/^\d{10}$/.test(ced)) return false
  const dig = ced.split("").map(Number)
  if (dig[2] > 5) return false
  let tot = 0
  for (let i = 0; i < 9; i++) {
    let m = dig[i] * (i % 2 === 0 ? 2 : 1)
    if (m > 9) m -= 9
    tot += m
  }
  const ver = tot % 10 === 0 ? 0 : 10 - (tot % 10)
  return ver === dig[9]
}

function filaDesde(celdas: string[]): FilaCliente {
  const [tipo, identificacion, nombre, email, telefono, direccion, ciudad, frecuente] = celdas
  return {
    tipo_identificacion: normalizarTipo(tipo || ""),
    identificacion: (identificacion || "").trim(),
    nombre_razon_social: (nombre || "").trim(),
    email: (email || "").trim(),
    telefono: (telefono || "").trim(),
    direccion: (direccion || "").trim(),
    ciudad: (ciudad || "").trim(),
    es_cliente_frecuente: normalizarTipo(frecuente || "").replace("SÍ", "SI"),
  }
}

function vacia(fila: FilaCliente) {
  return COLUMNAS_CLIENTE.every((c) => !fila[c])
}

export function erroresDeFila(fila: FilaCliente): string[] {
  const errores: string[] = []
  if (!fila.tipo_identificacion) errores.push("tipo_identificacion vacío")
  else if (!TIPOS.has(fila.tipo_identificacion)) errores.push("tipo_identificacion solo acepta CEDULA, RUC, PASAPORTE, CONSUMIDOR FINAL")
  if (!fila.identificacion) errores.push("identificacion vacía")
  if (!fila.nombre_razon_social) errores.push("nombre_razon_social vacío")
  if (!fila.email) errores.push("email vacío")
  else if (!fila.email.includes("@")) errores.push("email sin @")
  if (!fila.telefono) errores.push("telefono vacío")
  if (!fila.direccion) errores.push("direccion vacía")
  if (!fila.ciudad) errores.push("ciudad vacía")
  if (!fila.es_cliente_frecuente) errores.push("es_cliente_frecuente vacío")
  else if (fila.es_cliente_frecuente !== "SI" && fila.es_cliente_frecuente !== "NO") errores.push("es_cliente_frecuente solo acepta SI o NO")

  if (fila.tipo_identificacion === "CEDULA" && fila.identificacion && !validarCedulaEC(fila.identificacion)) errores.push("cédula mal escrita")
  if (fila.tipo_identificacion === "RUC" && fila.identificacion && !/^\d{13}$/.test(fila.identificacion)) errores.push("RUC que no tiene 13 dígitos")
  if (fila.tipo_identificacion === "CONSUMIDOR FINAL" && fila.identificacion && fila.identificacion !== "9999999999999") {
    errores.push("CONSUMIDOR FINAL usa la identificación 9999999999999")
  }
  return errores
}

export function revisarTabla(matriz: unknown[][]): { error?: string; filas: FilaRevisada[] } {
  if (!matriz.length) return { error: "El archivo no tiene filas", filas: [] }
  const encabezado = COLUMNAS_CLIENTE.map((_, i) => textoCelda(matriz[0][i]).toLowerCase())
  const faltan = COLUMNAS_CLIENTE.filter((col, i) => encabezado[i] !== col)
  if (faltan.length) return { error: `La primera fila debe tener estas columnas en este orden: ${COLUMNAS_CLIENTE.join(" | ")}`, filas: [] }

  const filas: FilaRevisada[] = []
  const vistas = new Map<string, number>()
  for (let i = 1; i < matriz.length; i++) {
    const celdas = COLUMNAS_CLIENTE.map((_, col) => textoCelda(matriz[i]?.[col]))
    const datos = filaDesde(celdas)
    if (vacia(datos)) continue
    const errores = erroresDeFila(datos)
    const clave = datos.identificacion
    if (clave) {
      const previa = vistas.get(clave)
      if (previa) errores.push(`identificación repetida en el archivo (fila ${previa})`)
      else vistas.set(clave, i + 1)
    }
    filas.push({ numero: i + 1, datos, errores })
  }
  if (!filas.length) return { error: "No hay clientes en el archivo", filas: [] }
  return { filas }
}

export function separarCsv(linea: string, separador: string) {
  const celdas: string[] = []
  let actual = ""
  let comillas = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (ch === '"') {
      if (comillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else comillas = !comillas
    } else if (ch === separador && !comillas) {
      celdas.push(actual.trim())
      actual = ""
    } else actual += ch
  }
  celdas.push(actual.trim())
  return celdas
}

export function matrizDesdeCsv(texto: string): unknown[][] {
  const limpio = texto.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lineas = limpio.split("\n").filter((l) => l.trim() !== "")
  if (!lineas.length) return []
  const separador = (lineas[0].match(/;/g) || []).length > (lineas[0].match(/,/g) || []).length ? ";" : ","
  return lineas.map((l) => separarCsv(l, separador))
}

export function tipoIdDe(tipo: string) {
  if (tipo === "RUC") return "04"
  if (tipo === "PASAPORTE") return "06"
  if (tipo === "CONSUMIDOR FINAL") return "07"
  return "05"
}

export function tipoDesdeCliente(tipoId: string, identificacion: string) {
  if (identificacion === "9999999999999" || tipoId === "07") return "CONSUMIDOR FINAL"
  if (tipoId === "04") return "RUC"
  if (tipoId === "06" || tipoId === "08") return "PASAPORTE"
  return "CEDULA"
}

export function datosGuardables(fila: FilaCliente) {
  return {
    tipoId: tipoIdDe(fila.tipo_identificacion),
    identificacion: fila.identificacion,
    razonSocial: fila.nombre_razon_social,
    email: fila.email,
    telefono: fila.telefono,
    direccion: fila.direccion,
    ciudad: fila.ciudad,
    frecuente: fila.es_cliente_frecuente === "SI",
    tipoCliente: fila.tipo_identificacion === "RUC" ? "JURIDICA" : "NATURAL",
  }
}
