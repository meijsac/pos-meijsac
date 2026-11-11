import { VisorComprobante } from "./visor"

export default async function Page({ params, searchParams }: { params: Promise<{ clave: string }>; searchParams: Promise<{ ver?: string }> }) {
  const { clave } = await params
  const consulta = await searchParams
  return <VisorComprobante clave={String(clave || "").replace(/\D/g, "")} soloLectura={consulta.ver === "1"} />
}
