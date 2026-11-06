"use client"
import { useEffect, useState } from "react"

export default function KDS(){
  const [pedidos,setPedidos]=useState<any[]>([])

  useEffect(()=>{
    const cargar = ()=>{
      const cola = JSON.parse(localStorage.getItem("meijsac_kds")||localStorage.getItem("meijsac_cola_cocina")||"[]")
      // calcula tiempo real en minutos desde timestamp
      const conTiempo = cola.map((p:any)=>{
        const inicio = p.timestamp || p.id
        const diffMin = Math.floor((Date.now() - inicio)/60000)
        return {...p, tiempo: diffMin>=0 && diffMin<10000 ? diffMin : 0 }
      })
      setPedidos(conTiempo)
    }
    cargar()
    window.addEventListener("storage", cargar)
    const t=setInterval(cargar,1000)
    return ()=>{ window.removeEventListener("storage", cargar); clearInterval(t) }
  },[])

  const marcarListo = (id:number)=>{
    const keys = ["meijsac_kds","meijsac_cola_cocina"]
    keys.forEach(k=>{
      const data = JSON.parse(localStorage.getItem(k)||"[]")
      const upd = data.map((x:any)=> x.id===id ? {...x, estado:"LISTO"} : x)
      localStorage.setItem(k, JSON.stringify(upd))
    })
    setPedidos(prev=>prev.map(p=> p.id===id ? {...p, estado:"LISTO"} : p))
  }

  const limpiarTodo = ()=>{
    if(!confirm("¿Borrar toda la cola de cocina?")) return
    localStorage.removeItem("meijsac_kds")
    localStorage.removeItem("meijsac_cola_cocina")
    setPedidos([])
  }

  const enCola = pedidos.filter(p=>p.estado==="EN_COLA")

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="flex justify-between items-center mb-4">
        <button onClick={()=>location.href='/dashboard/restaurante'} className="bg-white/10 px-3 py-2 rounded-xl text-xs">← Volver al Dashboard</button>
        <h1 className="font-black text-white">KDS COCINA 🔥 {enCola.length} platos</h1>
        <button onClick={limpiarTodo} className="bg-red-600 px-3 py-2 rounded-xl text-xs font-black">Limpiar KDS</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {enCola.map(p=>{
          const color = p.tiempo<10?"border-green-500": p.tiempo<20?"border-yellow-500 animate-pulse" : "border-red-500 animate-bounce bg-red-500/10"
          return (
            <div key={p.id} className={`bg-[#1a0f0f] border-2 ${color} rounded-2xl p-4`}>
              <div className="flex justify-between text-[11px] opacity-70">
                <b className="text-white text-sm">MESA {p.mesa||p.mesaId}</b>
                <span>{p.tiempo} min</span>
              </div>
              <div className="text-white font-black text-lg mt-2">{p.plato}</div>
              <div className="text-yellow-300 text-xs mt-1">{p.mods?.termino} • {p.mods?.acomp} {p.mods?.nota? `"${p.mods.nota}"` : ""}</div>
              <button onClick={()=>marcarListo(p.id)} className="w-full bg-white text-black font-black py-3 rounded-xl mt-4 active:scale-95">LISTO ✓</button>
            </div>
          )
        })}
      </div>
      {enCola.length===0 && <div className="text-center text-white/30 mt-20">Sin pedidos en cola</div>}
    </div>
  )
}