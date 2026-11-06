"use client"
import { useState, useEffect } from "react"

type Mods = { termino?:string, acomp?:string, nota?:string }
type Item = { id:number, nombre:string, precio:number, cat:string, mods:Mods, cant:number }
type Mesa = { id:number, nombre:string, zona:string, estado:"LIBRE"|"OCUPADA"|"CUENTA"|"SUCIA", mesero:string, inicio:string|null, items:Item[], tiempo:number }

const MENU = [
  {id:1, nombre:"Lomo Fino", precio:18.50, cat:"CARNES"},
  {id:2, nombre:"Hamburguesa Doble", precio:8.90, cat:"CARNES"},
  {id:3, nombre:"Cerveza Club", precio:3.50, cat:"BEBIDAS"},
  {id:4, nombre:"Almuerzo Ejecutivo", precio:5.50, cat:"ALMUERZOS"},
  {id:5, nombre:"Coca Cola", precio:2.00, cat:"BEBIDAS"},
  {id:6, nombre:"Tigrillo", precio:6.50, cat:"ALMUERZOS"},
]

export default function AppMesero(){
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [mesaActiva, setMesaActiva] = useState<number|null>(null)
  const [cat, setCat] = useState("CARNES")
  const [mods, setMods] = useState<Mods>({})
  const [platoSel, setPlatoSel] = useState<Item|null>(null)
  const [nota, setNota] = useState("")

  useEffect(()=>{
    const data = JSON.parse(localStorage.getItem("meijsac_restaurante_mesas")||"[]")
    if(data.length>0){
      setMesas(data)
    } else {
      const init = Array.from({length:12},(_,i)=>({ id:i+1, nombre:`Mesa ${i+1}`, zona: i<6?"Salón":"Terraza", estado:"LIBRE", mesero:"", inicio:null, items:[], tiempo:0 } as Mesa))
      localStorage.setItem("meijsac_restaurante_mesas", JSON.stringify(init)) // FIX: esto faltaba, por eso se eliminaban
      setMesas(init)
    }
  },[])

  const guardar = (lista:Mesa[]) => {
    localStorage.setItem("meijsac_restaurante_mesas", JSON.stringify(lista))
    setMesas(lista)
  }

  const seleccionarMesa = (id:number) => {
  const m = mesas.find(x=>x.id===id)
  if(m?.estado==="CUENTA"){
    alert(`Mesa ${m.nombre} en CUENTA - ya está en caja esperando pago`)
    return
  }
  if(m?.estado==="SUCIA"){
    alert(`Mesa ${m.nombre} SUCIA - limpiar en Salón primero`)
    return
  }
  setMesaActiva(id)
}

  const abrirMods = (plato:any) => {
    setPlatoSel({...plato, cant:1, mods:{}})
    setMods({})
    setNota("")
  }

  const enviarACocina = () => {
    if(!platoSel || mesaActiva===null) return
    // Valida término si es carne
    if(platoSel.cat==="CARNES" &&!mods.termino){
      alert("Selecciona término de carne")
      return
    }
    const itemFinal: Item = {...platoSel, mods:{...mods, nota}, cant:1 }

    // 1. Ocupa mesa
    const lista = mesas.map(m=>{
      if(m.id!==mesaActiva) return m
      const nueva = m.estado==="LIBRE"? {...m, estado:"OCUPADA" as const, inicio:new Date().toISOString(), mesero:"Yo", tiempo:0} : m
      return {...nueva, items:[...nueva.items, itemFinal]}
    })
    guardar(lista)

    // 2. ENVIO POR PLATO - 1 ticket = 1 plato
    const ticket = {
      id: Date.now(),
      mesa: mesaActiva,
      mesaId: mesaActiva,
      plato: itemFinal.nombre,
      items: [itemFinal],
      mods: itemFinal.mods,
      hora: new Date().toLocaleTimeString(),
      estado:"EN_COLA",
      tiempo:0,
      timestamp: Date.now()
    }
    const kds = JSON.parse(localStorage.getItem("meijsac_kds")||"[]")
    const cola = JSON.parse(localStorage.getItem("meijsac_cola_cocina")||"[]")
    kds.push(ticket); cola.push(ticket)
    localStorage.setItem("meijsac_kds", JSON.stringify(kds))
    localStorage.setItem("meijsac_cola_cocina", JSON.stringify(cola))

    if(navigator.vibrate) navigator.vibrate([100,50,100])
    setPlatoSel(null)
    setMods({})
    setNota("")
  }

  const mesa = mesas.find(m=>m.id===mesaActiva)

  if(mesaActiva===null){
    return (
      <div className="min-h-screen bg-[#080c14] text-white p-3">
        <div className="bg-[#1e293b] p-4 rounded-2xl flex justify-between items-center mb-3">
          <div><h1 className="font-black text-sm">APP MESERO 📱</h1><p className="text-[10px] opacity-50">Selecciona una mesa para tomar pedido</p></div>
          <div className="text-[10px] bg-[#00f5d4]/20 text-[#00f5d4] px-2 py-1 rounded-full">{mesas.filter(m=>m.estado==="OCUPADA").length} Ocupadas</div>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-20">
          {mesas.map(m=>{
            const col = m.estado==="LIBRE"?"bg-blue-500/20 border-blue-500/30 text-blue-200": m.estado==="OCUPADA"?"bg-green-500/20 border-green-500/40 text-green-200": m.estado==="CUENTA"?"bg-yellow-500/20 border-yellow-500/40 text-yellow-200 opacity-60":"bg-red-500/20 border-red-500/30 text-red-200 opacity-60"
            const bloqueada = m.estado==="CUENTA" || m.estado==="SUCIA"
            return (
              <button key={m.id} onClick={()=>seleccionarMesa(m.id)} className={`${col} border p-4 rounded-2xl text-left active:scale-95 transition ${bloqueada?"":""}`}>
                <div className="font-black text-[15px] flex justify-between">{m.nombre} {bloqueada && <span className="text-[10px]">🔒</span>}</div>
                <div className="text-[10px] opacity-70">{m.zona} • {m.estado}</div>
                <div className="mt-2 text-[11px] font-bold">{m.items.length>0? `${m.items.length} platos` : "Libre - AZUL"} {bloqueada? "- En Caja":""}</div>
              </button>
            )
          })}
        </div>
        <div className="fixed bottom-3 left-3 right-3 bg-[#1e293b] p-3 rounded-2xl border border-white/10 flex gap-2">
          <button onClick={()=>location.href='/dashboard/restaurante/salon'} className="flex-1 bg-white/10 py-3 rounded-xl text-xs font-bold">🖥️ Ver POS</button>
          <button onClick={()=>location.href='/dashboard/restaurante/kds'} className="flex-1 bg-red-500 py-3 rounded-xl text-xs font-black">🔥 KDS Cocina</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col">
      <div className="bg-[#1e293b] p-4 flex justify-between items-center">
        <button onClick={()=>setMesaActiva(null)} className="bg-white/10 px-3 py-2 rounded-xl text-xs">← Mesas</button>
        {/* PROTECCION: sin $ en header */}
        <div className="text-center"><div className="font-black">{mesa?.nombre} • {mesa?.zona}</div><div className="text-[10px] opacity-60">{mesa?.items.length} platos en comanda</div></div>
        <button onClick={()=>{ const kds=JSON.parse(localStorage.getItem("meijsac_cola_cocina")||"[]"); alert(`En cocina: ${kds.filter((x:any)=>x.mesa===mesaActiva).length} platos` )}} className="bg-[#00f5d4]/20 text-[#00f5d4] px-3 py-2 rounded-xl text-[10px] font-black">KDS</button>
      </div>

      <div className="p-3 space-y-2 max-h-[35vh] overflow-y-auto bg-black/20">
        {mesa?.items.map((it,idx)=>(
          <div key={idx} className="bg-[#1e293b] p-3 rounded-xl flex justify-between border border-white/5">
            <div><div className="font-bold text-sm">{it.nombre}</div><div className="text-[10px] text-yellow-300">{it.mods.termino} {it.mods.acomp} {it.mods.nota && `"${it.mods.nota}"`}</div></div>
            {/* sin precio para mesero */}
            <div className="font-black text-[#00f5d4] text-xs">x{it.cant}</div>
          </div>
        ))}
        {(!mesa || mesa.items.length===0) && <div className="text-center opacity-30 text-xs py-6">Aún sin pedidos - Agrega abajo</div>}
      </div>

      <div className="flex gap-2 p-3 overflow-x-auto">
        {["CARNES","BEBIDAS","ALMUERZOS"].map(c=><button key={c} onClick={()=>setCat(c)} className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap ${cat===c?"bg-white text-black":"bg-white/10"}`}>{c}</button>)}
      </div>

      <div className="flex-1 grid grid-cols-2 gap-2 p-3 pb-28">
        {MENU.filter(m=>m.cat===cat).map(plato=>(
          <button key={plato.id} onClick={()=>abrirMods(plato)} className="bg-[#1e293b] border border-white/10 p-4 rounded-2xl text-left active:scale-95">
            <div className="font-bold text-sm">{plato.nombre}</div>
            <div className="text-[10px] opacity-50 mt-1">Tocar para personalizar</div>
          </button>
        ))}
      </div>

      {platoSel && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-[#0f172a] w-full max-w-md rounded-t-[24px] sm:rounded-2xl p-5 border-t border-[#00f5d4]/30">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden"></div>
            <h2 className="font-black text-[#00f5d4] text-lg">{platoSel.nombre}</h2>
            <p className="text-[11px] opacity-60">Personaliza y envía a cocina en tiempo real</p>
            <div className="space-y-4 mt-5">
              {platoSel.cat==="CARNES" && (
                <>
                <div><label className="text-[11px] font-bold">Término de carne *</label><select className="w-full bg-black border border-white/20 p-4 rounded-xl mt-1 text-sm" value={mods.termino||""} onChange={e=>setMods({...mods, termino:e.target.value})}><option value="">Selecciona término...</option><option>Tres cuartos</option><option>Medio</option><option>Bien cocido</option><option>Jugoso</option></select></div>
                <div><label className="text-[11px] font-bold">Acompañante</label><select className="w-full bg-black border border-white/20 p-4 rounded-xl mt-1 text-sm" value={mods.acomp||""} onChange={e=>setMods({...mods, acomp:e.target.value})}><option>Papas fritas</option><option>Ensalada fresca</option><option>Arroz</option><option>Vegetales</option></select></div>
                </>
              )}
              <div><label className="text-[11px] font-bold">Nota para cocina</label><input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Ej: Sin cebolla, salsa aparte..." className="w-full bg-black border border-white/20 p-4 rounded-xl mt-1 text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={()=>setPlatoSel(null)} className="flex-1 bg-white/10 py-4 rounded-xl font-bold">Cancelar</button>
              <button onClick={enviarACocina} className="flex-[2] bg-[#00f5d4] text-black py-4 rounded-xl font-black text-[15px]">ENVIAR A COCINA 🔥</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}