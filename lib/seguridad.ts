import { createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv, createHash } from "crypto"
import bcrypt from "bcryptjs"
import { masterKey } from "@/lib/security/crypto"
import { secretoJwt } from "@/lib/empresa-sesion"

const COMUNES = ["12345678", "password", "admin", "meijsac", "123456789", "qwerty123"]

export function exigeCaptcha(token: unknown) {
  return Boolean(String(token || "").trim())
}

export function crearCaptcha() {
  const izquierda = 2 + Math.floor(Math.random() * 8)
  const derecha = 2 + Math.floor(Math.random() * 8)
  const suma = Math.random() < 0.5
  const a = suma || izquierda >= derecha ? izquierda : derecha
  const b = suma || izquierda >= derecha ? derecha : izquierda
  const respuesta = suma ? a + b : a - b
  const expira = Date.now() + 5 * 60 * 1000
  const mac = createHmac("sha256", secretoJwt()).update(`${expira}.${respuesta}`).digest("base64url")
  return { pregunta: `${a} ${suma ? "+" : "-"} ${b}`, token: `${expira}.${mac}` }
}

export function captchaCorrecto(token: unknown, respuesta: unknown) {
  const partes = String(token || "").split(".")
  if (partes.length !== 2) return false
  const expira = Number(partes[0])
  const numero = String(respuesta ?? "").trim()
  if (!Number.isFinite(expira) || expira < Date.now() || !/^\d+$/.test(numero)) return false
  const mac = createHmac("sha256", secretoJwt()).update(`${expira}.${numero}`).digest("base64url")
  const recibido = Buffer.from(partes[1])
  const esperado = Buffer.from(mac)
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}

export function confirmaClaveIngreso(hash: string, clave: string) {
  if (!clave || !hash) return Promise.resolve(false)
  return bcrypt.compare(clave, hash)
}

export function claveValida(clave: string) {
  if (clave.length < 8) return "La contraseña debe tener al menos 8 caracteres"
  if (!/[A-Z]/.test(clave) || !/[a-z]/.test(clave) || !/[0-9]/.test(clave) || !/[^A-Za-z0-9]/.test(clave)) {
    return "La contraseña necesita mayúscula, minúscula, número y símbolo"
  }
  if (COMUNES.includes(clave.toLowerCase())) return "Esa contraseña es demasiado común"
  return ""
}

export function sanitizarTexto(valor: unknown) {
  return String(valor ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .slice(0, 500)
}

export type IntentoLogin = { correo: string; ip: string; fecha: number; exitoso: boolean; canal: "LOGIN" | "POS" }

export function evaluarBloqueo(intentos: IntentoLogin[], correo: string, ip: string, ahora: number, canal: "LOGIN" | "POS" = "LOGIN") {
  const quince = ahora - 15 * 60 * 1000
  const hora = ahora - 60 * 60 * 1000
  const delCorreo = intentos.filter((i) => i.correo === correo && i.canal === canal && !i.exitoso && i.fecha >= quince)
  const fallosIp = intentos.filter((i) => i.ip === ip && i.canal === "LOGIN" && !i.exitoso && i.fecha >= quince)
  const deIp = intentos.filter((i) => i.ip === ip && i.fecha >= hora)
  const captchaIp = intentos.filter((i) => i.ip === ip && i.correo === "captcha" && !i.exitoso && i.fecha >= quince)
  if (captchaIp.length >= 3) return { bloqueado: true, mensaje: "IP bloqueada 15 minutos por captcha fallido", esperaMs: 0 }
  if (fallosIp.length >= 5) return { bloqueado: true, mensaje: "Demasiados intentos. Intenta en 15 minutos.", esperaMs: 0 }
  if (deIp.length >= 20) return { bloqueado: true, mensaje: "IP bloqueada por demasiados intentos", esperaMs: 0 }
  if (canal === "POS" && delCorreo.length >= 5) return { bloqueado: true, mensaje: "POS bloqueado 15 minutos", esperaMs: 0 }
  if (canal === "LOGIN" && delCorreo.length >= 5) return { bloqueado: true, mensaje: "Demasiados intentos. Intenta en 15 minutos.", esperaMs: 0 }
  return { bloqueado: false, mensaje: "", esperaMs: delCorreo.length * 1000 }
}

export function puedeAbrirCaja(abiertas: { usuario: string; dispositivo: string }[], usuario: string, dispositivo: string) {
  const otra = abiertas.find((a) => a.usuario === usuario && a.dispositivo !== dispositivo && a.dispositivo !== "")
  if (otra) return { ok: false as const, error: "Ya tienes una caja abierta en otro dispositivo" }
  return { ok: true as const }
}

export function evaluarWhatsapp(fechas: number[], ahora: number, bloqueadoHasta = 0) {
  if (bloqueadoHasta > ahora) return { permitir: false, bloquearHasta: bloqueadoHasta, alerta: false }
  const minuto = fechas.filter((f) => ahora - f < 60_000)
  if (minuto.length >= 20) return { permitir: false, bloquearHasta: ahora + 60 * 60 * 1000, alerta: true }
  if (minuto.length >= 5) return { permitir: false, bloquearHasta: 0, alerta: false }
  return { permitir: true, bloquearHasta: 0, alerta: false }
}

export function revisarMensajeWhatsapp(texto: string, archivo = "") {
  const nombre = archivo.toLowerCase()
  if (/\.(exe|apk|zip)(\?|$)/.test(nombre)) return { sospechoso: true, respuesta: "" }
  if (/https?:\/\/|bit\.ly|tinyurl/i.test(texto) && !/meijsac\.com/i.test(texto)) return { sospechoso: true, respuesta: "" }
  if (/clave de acceso|contraseña|password|costos?|ruc/i.test(texto)) {
    return { sospechoso: false, respuesta: "Por seguridad, eso solo se ve en el sistema" }
  }
  return { sospechoso: false, respuesta: "" }
}

export function pieWhatsapp() {
  return "Tu factura de MEIJSAC\nMEIJSAC nunca te pedirá tu contraseña por WhatsApp"
}

export function verificarFirmaMeta(cuerpo: string, firma: string, secreto: string) {
  if (!firma || !secreto) return false
  const esperado = "sha256=" + createHmac("sha256", secreto).update(cuerpo).digest("hex")
  const a = Buffer.from(esperado)
  const b = Buffer.from(firma)
  return a.length === b.length && timingSafeEqual(a, b)
}

const ACCIONES: Record<string, string[]> = {
  ADMIN: ["facturar", "costos", "utilidad", "kardex", "transferir", "anular", "exportar", "eliminar", "whatsapp", "respaldo", "precio", "gaveta"],
  CONTADOR: ["facturar", "costos", "utilidad", "kardex", "anular", "exportar"],
  VENDEDOR: ["facturar"],
  CAJERO: ["facturar", "cobrar"],
}

export function puede(rol: string, accion: string) {
  return (ACCIONES[String(rol || "").toUpperCase()] || []).includes(accion)
}

export function accesoEmpresa(empresaSesion: string, empresaRecurso: string) {
  if (!empresaRecurso || empresaRecurso !== empresaSesion) return 403
  return 200
}

export function claveCifrado() {
  return masterKey()
}

export function encriptar(texto: string) {
  const iv = randomBytes(12)
  const cifrado = createCipheriv("aes-256-gcm", claveCifrado(), iv)
  const datos = Buffer.concat([cifrado.update(texto, "utf8"), cifrado.final()])
  const tag = cifrado.getAuthTag()
  return Buffer.concat([iv, tag, datos]).toString("base64")
}

export function encriptarBytes(binario: Buffer) {
  return encriptar(binario.toString("base64"))
}

export function desencriptarBytes(paquete: string) {
  return Buffer.from(desencriptar(paquete), "base64")
}

export function desencriptar(paquete: string) {
  const raw = Buffer.from(paquete, "base64")
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const datos = raw.subarray(28)
  const cifrado = createDecipheriv("aes-256-gcm", claveCifrado(), iv)
  cifrado.setAuthTag(tag)
  return Buffer.concat([cifrado.update(datos), cifrado.final()]).toString("utf8")
}

export function codigoTotp(secreto: Buffer, tiempo = Date.now()) {
  const contador = Math.floor(tiempo / 30000)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(contador))
  const hmac = createHmac("sha1", secreto).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const codigo = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(codigo).padStart(6, "0")
}

export function totpValido(secreto: Buffer, codigo: string) {
  return [0, -30000, 30000].some((delta) => codigoTotp(secreto, Date.now() + delta) === codigo)
}

export function hashCodigo(codigo: string) {
  return createHash("sha256").update(codigo).digest("hex")
}

export function ipDe(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || ""
  return fwd.split(",")[0].trim() || "0.0.0.0"
}

export function navegadorDe(req: Request) {
  return (req.headers.get("user-agent") || "desconocido").slice(0, 180)
}
