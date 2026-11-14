import { readFileSync } from "fs"
import path from "path"
import { DOMParser } from "@xmldom/xmldom"
import { validateXML } from "xmllint-wasm"

const ESQUEMAS: Record<string, { archivo: string; version: string }> = {
  factura: { archivo: "factura_V1.1.0.xsd", version: "1.1.0" },
  notaCredito: { archivo: "NotaCredito_V1.1.0.xsd", version: "1.1.0" },
  comprobanteRetencion: { archivo: "ComprobanteRetencion_V2.0.0.xsd", version: "2.0.0" },
  guiaRemision: { archivo: "GuiaRemision_V1.1.0.xsd", version: "1.1.0" },
}

function archivo(nombre: string) {
  return readFileSync(path.join(process.cwd(), "lib", "sri", "xsd", nombre), "utf8")
}

export async function validarXmlOficial(xml: string) {
  const doc = new DOMParser({
    onError: () => undefined,
  }).parseFromString(String(xml || ""), "text/xml")
  const raiz = doc.documentElement
  const esquema = ESQUEMAS[raiz?.nodeName || ""]
  if (!raiz || !esquema) return ""
  const version = raiz.getAttribute("version") || ""
  if (version !== esquema.version) {
    return `La versión ${version || "(vacía)"} no es la vigente ${esquema.version} del esquema oficial ${esquema.archivo}`
  }
  const resultado = await validateXML({
    xml: { fileName: "comprobante.xml", contents: String(xml) },
    schema: [{ fileName: esquema.archivo, contents: archivo(esquema.archivo) }],
    preload: [{ fileName: "xmldsig-core-schema.xsd", contents: archivo("xmldsig-core-schema.xsd") }],
  })
  if (resultado.valid) return ""
  const detalle = resultado.errors[0]?.message || "no cumple el esquema"
  return `El XML no cumple el esquema oficial ${esquema.archivo}: ${detalle}`
}
