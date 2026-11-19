"use client"
import { useEffect, useState } from "react"
import { guardarRestaurante, leerLocal, leerRestaurante } from "@/lib/restaurante/sync"

const ESTACIONES = ["TODAS", "PARRILLA", "BARRA", "WOK", "COCINA"]

export default function KDS(){
  const [pedidos,setPedidos]=useState<any[]>([])
  const [estacion, setEstacion] = useState("TODAS")

  const aplicar = (tickets: any[]) => {
    const conTiempo = tickets.map((p: any) => {
      const inicio = p.timestamp || p.enviadoEn || p.id
      const diffMin = Math.floor((Date.now() - Number(inicio))/60000)
      const plato = p.plato || (Array.isArray(p.items) ? p.items.map((item: { nombre?: string }) => item.nombre).filter(Boolean).join(", ") : "")
      return { ...p, plato, tiempo: diffMin >= 0 && diffMin < 10000 ? diffMin : 0 }
    })
    setPedidos(conTiempo)
  }

  useEffect(()=>{
    const cargar = () => {
      leerRestaurante().then((remoto) => {
        const tickets = remoto?.tickets?.length ? remoto.tickets : leerLocal("meijsac_kds")
        aplicar(tickets)
      }).catch(() => aplicar(leerLocal("meijsac_kds")))
    }
    cargar()
    const t = setInterval(cargar, 2000)
    return () => clearInterval(t)
  },[])

  const marcar = async (id: number, estado: "PREPARANDO" | "LISTO") => {
    const remoto = await leerRestaurante()
    const ahora = new Date().toISOString()
    const base = remoto?.tickets?.length ? remoto.tickets : leerLocal("meijsac_kds")
    const tickets = base.map((ticket: any) => ticket.id === id ? {
      ...ticket,
      estado,
      preparandoEn: estado === "PREPARANDO" ? ahora : ticket.preparandoEn,
      listoEn: estado === "LISTO" ? ahora : ticket.listoEn,
      items: Array.isArray(ticket.items) ? ticket.items.map((item: any) => ({ ...item, estado, preparandoEn: estado === "PREPARANDO" ? ahora : item.preparandoEn, listoEn: estado === "LISTO" ? ahora : item.listoEn })) : ticket.items,
    } : ticket)
    const marcado = tickets.find((ticket: any) => ticket.id === id)
    const uids = new Set((marcado?.items || []).map((item: { uid?: string }) => item.uid).filter(Boolean))
    const mesas = (remoto?.mesas || leerLocal("meijsac_restaurante_mesas")).map((mesa: any) => ({
      ...mesa,
      items: Array.isArray(mesa.items) ? mesa.items.map((item: any) => uids.has(item.uid) ? { ...item, estado, preparandoEn: estado === "PREPARANDO" ? ahora : item.preparandoEn, listoEn: estado === "LISTO" ? ahora : item.listoEn } : item) : mesa.items,
    }))
    localStorage.setItem("meijsac_kds", JSON.stringify(tickets))
    localStorage.setItem("meijsac_cola_cocina", JSON.stringify(tickets))
    localStorage.setItem("meijsac_restaurante_mesas", JSON.stringify(mesas))
    await guardarRestaurante({ tickets, mesas })
    aplicar(tickets)
  }

  const limpiarTodo = async () => {
    if(!confirm("¿Borrar toda la cola de cocina?")) return
    localStorage.setItem("meijsac_kds", "[]")
    localStorage.setItem("meijsac_cola_cocina", "[]")
    await guardarRestaurante({ tickets: [] })
    setPedidos([])
  }

  const activos = pedidos.filter((p) => ["PENDIENTE", "EN_COLA", "PREPARANDO"].includes(p.estado) && (estacion === "TODAS" || String(p.destino || "COCINA").toUpperCase() === estacion))

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="flex justify-between items-center mb-4 gap-2">
        <button onClick={()=>location.href='/dashboard/restaurante'} className="bg-white/10 px-3 py-2 rounded-xl text-xs">← Volver al Dashboard</button>
        <h1 className="font-black text-white">KDS COCINA 🔥 {activos.length} platos</h1>
        <button onClick={() => { void limpiarTodo() }} className="bg-red-600 px-3 py-2 rounded-xl text-xs font-black">Limpiar KDS</button>
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {ESTACIONES.map((nombre) => (
          <button key={nombre} onClick={() => setEstacion(nombre)} className={`px-3 py-2 rounded-full text-[11px] font-black ${estacion === nombre ? "bg-white text-black" : "bg-white/10 text-white"}`}>{nombre}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {activos.map(p=>{
          const color = p.tiempo<10?"border-green-500": p.tiempo<20?"border-yellow-500 animate-pulse" : "border-red-500 animate-bounce bg-red-500/10"
          const preparando = p.estado === "PREPARANDO"
          return (
            <div key={p.id} className={`bg-[#1a0f0f] border-2 ${color} rounded-2xl p-4`}>
              <div className="flex justify-between text-[11px] opacity-70">
                <b className="text-white text-sm">MESA {p.nombre || p.mesa||p.mesaId}</b>
                <span>{p.tiempo} min</span>
              </div>
              <div className="text-[10px] text-white/50">{p.destino || "COCINA"} · {p.mesero || ""} · {preparando ? "PREPARANDO" : "PENDIENTE"}</div>
              <div className="text-white font-black text-lg mt-2">{p.plato}</div>
              <div className="text-yellow-300 text-xs mt-1">{p.mods?.termino} {p.mods?.termino && p.mods?.acomp ? "•" : ""} {p.mods?.acomp} {p.mods?.nota? `"${p.mods.nota}"` : ""}</div>
              {preparando
                ? <button onClick={() => { void marcar(p.id, "LISTO") }} className="w-full bg-white text-black font-black py-3 rounded-xl mt-4 active:scale-95">LISTO ✓</button>
                : <button onClick={() => { void marcar(p.id, "PREPARANDO") }} className="w-full bg-amber-300 text-black font-black py-3 rounded-xl mt-4 active:scale-95">PREPARANDO</button>}
            </div>
          )
        })}
      </div>
      {activos.length===0 && <div className="text-center text-white/30 mt-20">Sin pedidos en esta estación</div>}
    </div>
  )
}
