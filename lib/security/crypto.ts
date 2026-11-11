import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

export function masterKey() {
  const hex = process.env.ENCRYPTION_MASTER_KEY || ""
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_MASTER_KEY debe existir y tener 64 caracteres hexadecimales")
  }
  return Buffer.from(hex, "hex")
}

export function encryptBuffer(plano: Buffer) {
  const iv = randomBytes(12)
  const cifrado = createCipheriv("aes-256-gcm", masterKey(), iv)
  const encryptedData = Buffer.concat([cifrado.update(plano), cifrado.final()])
  const authTag = cifrado.getAuthTag()
  return { encryptedData, iv, authTag }
}

export function decryptBuffer(encryptedData: Buffer, iv: Buffer, authTag: Buffer) {
  const cifrado = createDecipheriv("aes-256-gcm", masterKey(), iv)
  cifrado.setAuthTag(authTag)
  return Buffer.concat([cifrado.update(encryptedData), cifrado.final()])
}
