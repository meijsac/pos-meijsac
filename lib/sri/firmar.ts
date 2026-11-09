import { signInvoiceXml } from "ec-sri-invoice-signer"

export function firmarFacturaXml(xml: string, p12: Buffer, clave: string) {
  if (!clave) throw new Error("Falta la contraseña del certificado .p12")
  return signInvoiceXml(xml, p12, { pkcs12Password: clave })
}
