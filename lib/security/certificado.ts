import * as forge from "node-forge"
import { prisma } from "@/lib/prisma"
import { encryptBuffer } from "@/lib/security/crypto"
import { subirFirmaCifrada } from "@/lib/security/storage"

function textoCertificado(cert: forge.pki.Certificate) {
  const attrs = cert.subject.attributes as Array<{ shortName?: string; name?: string; value?: string }>
  const serial = attrs.find((a) => a.shortName === "serialNumber" || a.name === "serialNumber")?.value || ""
  const sujeto = attrs.map((a) => a.value || "").join(" ")
  return `${serial} ${sujeto}`
}

export function rucCertificadoCoincide(texto: string, rucEmpresa: string) {
  const ruc = rucEmpresa.replace(/\D/g, "")
  if (ruc.length !== 13) return false
  const digitos = texto.replace(/\D/g, "")
  if (digitos.includes(ruc)) return true
  const cedulas = texto.match(/\d{10}/g) || []
  return cedulas.some((cedula) => ruc === `${cedula}001`)
}

export async function guardarCertificado(entrada: {
  empresaId: string
  rucEmpresa: string
  nombre: string
  p12: Buffer
  clave: string
}) {
  let abierto: forge.pkcs12.Pkcs12Pfx | null = null
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(entrada.p12.toString("binary")))
    try {
      abierto = forge.pkcs12.pkcs12FromAsn1(asn1, entrada.clave)
    } catch {
      throw new Error("Contraseña de firma incorrecta")
    }
    const bolsa = abierto.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]
    const cert = bolsa?.[0]?.cert
    if (!cert) throw new Error("El archivo no trae un certificado")
    const expira = cert.validity.notAfter
    if (!(expira instanceof Date) || expira.getTime() <= Date.now()) throw new Error("El certificado está caducado")
    const texto = textoCertificado(cert)
    if (!rucCertificadoCoincide(texto, entrada.rucEmpresa)) {
      throw new Error("El RUC del certificado no coincide con el RUC de la empresa")
    }
    const p12Cif = encryptBuffer(entrada.p12)
    const claveCif = encryptBuffer(Buffer.from(entrada.clave, "utf8"))
    const storagePath = await subirFirmaCifrada(entrada.empresaId, p12Cif.encryptedData)
    await prisma.certificadoSri.upsert({
      where: { empresaId: entrada.empresaId },
      create: {
        empresaId: entrada.empresaId,
        storagePath,
        p12Iv: p12Cif.iv.toString("base64"),
        p12Tag: p12Cif.authTag.toString("base64"),
        claveCifrada: claveCif.encryptedData.toString("base64"),
        claveIv: claveCif.iv.toString("base64"),
        claveTag: claveCif.authTag.toString("base64"),
        expira,
        titular: texto.slice(0, 300),
        nombre: entrada.nombre.slice(0, 180),
        rucCertificado: entrada.rucEmpresa,
      },
      update: {
        storagePath,
        p12Iv: p12Cif.iv.toString("base64"),
        p12Tag: p12Cif.authTag.toString("base64"),
        claveCifrada: claveCif.encryptedData.toString("base64"),
        claveIv: claveCif.iv.toString("base64"),
        claveTag: claveCif.authTag.toString("base64"),
        expira,
        titular: texto.slice(0, 300),
        nombre: entrada.nombre.slice(0, 180),
        rucCertificado: entrada.rucEmpresa,
      },
    })
    await prisma.firmaElectronica.upsert({
      where: { empresaId: entrada.empresaId },
      create: { empresaId: entrada.empresaId, nombre: entrada.nombre.slice(0, 180), titular: texto.slice(0, 300), expira },
      update: { nombre: entrada.nombre.slice(0, 180), titular: texto.slice(0, 300), expira },
    })
    await prisma.empresa.update({ where: { id: entrada.empresaId }, data: { firmaExpira: expira } })
    p12Cif.encryptedData.fill(0)
    claveCif.encryptedData.fill(0)
    return { expira, dias: Math.ceil((expira.getTime() - Date.now()) / 86400000), titular: texto.slice(0, 300) }
  } finally {
    entrada.p12.fill(0)
    abierto = null
  }
}
