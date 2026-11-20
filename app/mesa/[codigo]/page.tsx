import { mesaPublica } from "@/lib/restaurante/mesa-publica"
import { MesaCliente } from "./mesa-cliente"

export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const vista = await mesaPublica(codigo)
  if (!vista) {
    return <main className="min-h-screen bg-white text-slate-900 p-6 font-sans"><p className="text-lg font-bold">Esta mesa no está disponible.</p></main>
  }
  return <MesaCliente codigo={String(codigo || "").toLowerCase()} inicial={vista} />
}
