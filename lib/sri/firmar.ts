import { signInvoiceXml } from "ec-sri-invoice-signer"
import { prisma } from "@/lib/prisma"
import { decryptBuffer } from "@/lib/security/crypto"
import { descargarFirmaCifrada } from "@/lib/security/storage"

function limpiar(buffer: Buffer | null) {
  if (buffer && buffer.length) buffer.fill(0)
}

export function firmarFacturaXml(xml: string, p12: Buffer, clave: string) {
  if (!clave) throw new Error("Falta la contraseña del certificado .p12")
  return signInvoiceXml(xml, p12, { pkcs12Password: clave })
}

export async function firmarXmlEmpresa(empresaId: string, xml: string) {
  const cert = await prisma.certificadoSri.findUnique({ where: { empresaId } })
  if (!cert?.storagePath || !cert.claveCifrada) throw new Error("Falta el certificado. Súbelo de nuevo en Configuración.")
  const archivo = await descargarFirmaCifrada(cert.storagePath)
  let p12: Buffer | null = null
  let claveBuf: Buffer | null = null
  try {
    p12 = decryptBuffer(archivo, Buffer.from(cert.p12Iv, "base64"), Buffer.from(cert.p12Tag, "base64"))
    claveBuf = decryptBuffer(Buffer.from(cert.claveCifrada, "base64"), Buffer.from(cert.claveIv, "base64"), Buffer.from(cert.claveTag, "base64"))
    const clave = claveBuf.toString("utf8")
    const firmado = firmarFacturaXml(xml, p12, clave)
    claveBuf.fill(0)
    return firmado
  } finally {
    limpiar(p12)
    limpiar(claveBuf)
    limpiar(archivo)
  }
}
