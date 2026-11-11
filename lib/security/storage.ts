import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const FIRMA = "firmas-electronicas"
const COMPROBANTES = "comprobantes-sri"

function clienteAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor")
  if (url.startsWith("NEXT_PUBLIC_") || key.startsWith("NEXT_PUBLIC_")) {
    throw new Error("La llave de Storage no puede ser pública")
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function asegurarBucket(nombre: string) {
  const supabase = clienteAdmin()
  const { data } = await supabase.storage.getBucket(nombre)
  if (!data) {
    const creado = await supabase.storage.createBucket(nombre, { public: false })
    if (creado.error && !/already exists/i.test(creado.error.message)) throw new Error("No se pudo crear el bucket privado")
  } else if (data.public) {
    await supabase.storage.updateBucket(nombre, { public: false })
  }
  return supabase
}

export async function subirPrivado(bucket: string, ruta: string, datos: Buffer, tipo: string) {
  const supabase = await asegurarBucket(bucket)
  const { error } = await supabase.storage.from(bucket).upload(ruta, datos, { contentType: tipo, upsert: true })
  if (error) throw new Error("No se pudo guardar el archivo privado")
}

export async function descargarPrivado(bucket: string, ruta: string) {
  const supabase = clienteAdmin()
  const { data, error } = await supabase.storage.from(bucket).download(ruta)
  if (error || !data) throw new Error("No se pudo leer el certificado")
  return Buffer.from(await data.arrayBuffer())
}

export async function subirFirmaCifrada(empresaId: string, datos: Buffer) {
  const ruta = `${empresaId}/certificado.enc`
  await subirPrivado(FIRMA, ruta, datos, "application/octet-stream")
  return ruta
}

export async function descargarFirmaCifrada(ruta: string) {
  return descargarPrivado(FIRMA, ruta)
}

export async function archivarComprobante(empresaId: string, clave: string, xmlFirmado: string, respuesta: unknown) {
  const limpia = String(clave || "").replace(/\D/g, "")
  if (limpia.length !== 49 || !xmlFirmado) return
  const base = `${empresaId}/${limpia}`
  await subirPrivado(COMPROBANTES, `${base}.xml`, Buffer.from(xmlFirmado, "utf8"), "application/xml")
  await subirPrivado(COMPROBANTES, `${base}.json`, Buffer.from(JSON.stringify(respuesta ?? {}), "utf8"), "application/json")
}
