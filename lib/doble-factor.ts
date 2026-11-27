import { prisma } from "@/lib/prisma"
import { desencriptarBytes, totpValido } from "@/lib/seguridad"

export function dobleFactorActivo() {
  return process.env.DOBLE_FACTOR === "1"
}

export async function exigeDobleFactor(usuarioId: string, codigo: unknown) {
  if (!dobleFactorActivo()) return null
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { totpCifrado: true } })
  const paquete = String(usuario?.totpCifrado || "")
  if (!paquete) return null
  let secreto: Buffer
  try { secreto = desencriptarBytes(paquete) } catch { return { status: 401, error: "No se pudo verificar el segundo paso" } }
  const limpio = String(codigo || "").replace(/\D/g, "")
  if (!totpValido(secreto, limpio)) return { status: 401, error: "El código del segundo paso no coincide" }
  return null
}
