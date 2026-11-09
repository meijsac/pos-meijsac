import { VisorComprobante } from "./visor"

export default async function Page({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params
  return <VisorComprobante clave={String(clave || "").replace(/\D/g, "")} />
}
