import { Client } from "@upstash/qstash"

export async function encolarReenvioSri(empresaId: string, claveAcceso: string) {
  const token = process.env.QSTASH_TOKEN || ""
  if (!token) return false
  const base = process.env.APP_URL || process.env.VERCEL_URL || ""
  if (!base) return false
  const origen = base.startsWith("http") ? base : `https://${base}`
  const cliente = new Client({ token })
  await cliente.publishJSON({
    url: `${origen}/api/sri/cola`,
    body: { empresaId, claveAcceso },
    retries: 3,
  })
  return true
}
