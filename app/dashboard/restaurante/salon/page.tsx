"use client"
import { useState, useEffect, useMemo } from "react"

type Mods = { termino?:string, acomp?:string, nota?:string }
type Item = { id:number, uid:string, nombre:string, precio:number, cat:string, mods:Mods, cant:number, estado:"PENDIENTE"|"ENVIADO" }
type Mesa = { id:number, nombre:string, zona:string, estado:"LIBRE"|"OCUPADA"|"CUENTA"|"SUCIA", mesero:string, inicio:string|null, items:Item[], tiempo:number }
type SplitFactura = { id:string, mesaOrigenId:number, numero: number, totalPartes: number, items: Item[], subtotal:number, iva:number, propina:number, total:number, esSplit: boolean, estado: "PENDIENTE"|"FACTURADA", cliente?:any, origen?:string }

const MENU_BASE: any[] = [
  {id:1, nombre:"Lomo Fino", precio:18.5, cat:"CARNES", destino:"PARRILLA", activo:true, iva:12, mods:[]},
  {id:2, nombre:"Chaulafan", precio:9.5, cat:"ARROCES", destino:"WOK", activo:true, iva:12, mods:[]},
  {id:3, nombre:"Cerveza Pilsener", precio:3, cat:"BEBIDAS", destino:"BARRA", activo:true, iva:12, mods:[]},
]

const genId = () => `${Date.now()}-${Math.random().toString(36).substring(2,9)}`

export default function SalonCompleto(){
  const [mounted, setMounted] = useState(false)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const esAppMesero = typeof window!== "undefined" && window.location.pathname.includes("mesero")
  const [mesaActiva, setMesaActiva] = useState(1)
  const [showMods, setShowMods] = useState<any>(null)
  const [showLib, setShowLib] = useState(false)
  const [catActiva, setCatActiva] = useState("CARNES")
  const [showSplitIguales, setShowSplitIguales] = useState(false)
  const [showSplitItems, setShowSplitItems] = useState(false)
  const [numPartes, setNumPartes] = useState(2)
  const [bandejas, setBandejas] = useState<Item[][]>([[],[]])
  const [modoEdicionMesas, setModoEdicionMesas] = useState(false)
  const [modoEdicionMenu, setModoEdicionMenu] = useState(false)
  const [showAddMesa, setShowAddMesa] = useState(false)
  const [showAddPlato, setShowAddPlato] = useState(false)
  const [nuevaMesa, setNuevaMesa] = useState({nombre:"", zona:"Salón"})
  const [nuevoPlato, setNuevoPlato] = useState({nombre:"", precio:0, cat:"CARNES", destino:"WOK", iva:15})
  const [menuRestaurante, setMenuRestaurante] = useState<any[]>(MENU_BASE)
  const CATEGORIAS_BASE = ["CARNES","ARROCES","BEBIDAS","ALMUERZOS","COMBOS"]
  const [categoriasMenu, setCategoriasMenu] = useState<string[]>(CATEGORIAS_BASE)
  const [showAddCategoria, setShowAddCategoria] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("")

  const MENU = menuRestaurante.filter((p:any)=>p.activo!==false)

  useEffect(()=>{
    const guardado = localStorage.getItem("meijsac_menu_restaurante")
    if(guardado) setMenuRestaurante(JSON.parse(guardado))
  },[])

  useEffect(()=>{ localStorage.setItem("meijsac_menu_restaurante", JSON.stringify(menuRestaurante)) },[menuRestaurante])

  useEffect(()=>{
    setMounted(true)
    const s=localStorage.getItem("meijsac_restaurante_mesas")
    if(s){ try{ setMesas(JSON.parse(s)) }catch{} }
    if(!s || JSON.parse(s||"[]").length===0){ setMesas(Array.from({length:12},(_,i)=>({ id:i+1, nombre:`Mesa ${i+1}`, zona: i<4?"Salón":i<8?"Terraza":"Barra", estado:"LIBRE", mesero:"", inicio:null, items:[], tiempo:0 } as Mesa))) }
  },[])

  useEffect(()=>{ if(mounted) localStorage.setItem("meijsac_restaurante_mesas", JSON.stringify(mesas)) },[mesas, mounted])
  useEffect(()=>{ const t=setInterval(()=>setMesas(ms=>ms.map(m=>m.estado==="OCUPADA" && m.inicio?{...m, tiempo:Math.floor((Date.now()-new Date(m.inicio).getTime())/60000)}:m)),60000); return ()=>clearInterval(t) },[])
  useEffect(()=>{
    const catGuardadas = localStorage.getItem("meijsac_categorias_menu")
    if(catGuardadas) setCategoriasMenu(JSON.parse(catGuardadas))
  },[])

  useEffect(()=>{ localStorage.setItem("meijsac_categorias_menu", JSON.stringify(categoriasMenu)) },[categoriasMenu])

  const mesa = useMemo(()=> mesas.find(m=>m.id===mesaActiva), [mesas, mesaActiva])
  const pendientes = useMemo(()=> mesa?.items.filter(i=>i.estado==="PENDIENTE")||[], [mesa])
  const total = useMemo(()=> mesa? mesa.items.reduce((s,i)=>s+(i.precio*i.cant),0) : 0, [mesa])

  if(!mounted) return <div className="min-h-screen bg-[#080c14] flex items-center justify-center text-white">Cargando salón...</div>

  const confirmarPlato = () => {
    if(!showMods) return
    setMesas(prev=>prev.map(m=>{
      if(m.id!==mesaActiva) return m
      const base = m.estado==="LIBRE"? {...m, estado:"OCUPADA" as const, inicio:new Date().toISOString(), mesero:"Mesero 01"} : m
      return {...base, items:[...base.items, {...showMods, estado:"PENDIENTE" as const}]}
    }))
    setShowMods(null)
  }

  const enviarLoteACocina = () => { if(!mesa || pendientes.length===0) return; const kds = JSON.parse(localStorage.getItem("meijsac_kds")||"[]"); kds.push({ id:Date.now(), mesa:mesa.id, nombre:mesa.nombre, zona:mesa.zona, hora:new Date().toLocaleTimeString(), items:pendientes, estado:"EN_COLA", tiempo:0 }); localStorage.setItem("meijsac_kds", JSON.stringify(kds)); setMesas(prev=>prev.map(m=> m.id===mesaActiva? {...m, items: m.items.map(i=> i.estado==="PENDIENTE"? {...i, estado:"ENVIADO"}: i)} : m)) }
  const preCuenta = () => { if(!mesa) return; setMesas(prev=>prev.map(m=> m.id===mesaActiva? {...m, estado:"CUENTA" as const}:m)) }

  // --- FIX: AHORA SI VA DIRECTO AL FACTURADOR ---
  const facturarSRI = () => {
    if(!mesa || mesa.items.length===0) { alert("Mesa sin consumo"); return }
    const transito = { 
      id: genId(), 
      mesaId: mesa.id, 
      mesaNombre: mesa.nombre, 
      mesaOrigenId: mesa.id, 
      origen:`Mesa ${mesa.id} - ${mesa.zona}`, 
      cliente:{nombre:"CONSUMIDOR FINAL MESA "+mesa.id, ruc:"9999999999999"}, 
      items: mesa.items.map(i=>({descripcion:`${i.nombre} ${i.mods.termino?`(${i.mods.termino})`:''} ${i.mods.acomp?`con ${i.mods.acomp}`:''} ${i.mods.nota?`[${i.mods.nota}]`:''}`, nombre:i.nombre, precio:i.precio, cantidad:i.cant, cant:i.cant, mods:i.mods, iva:15})), 
      subtotal: total, 
      iva: total*0.15, 
      propina: total*0.10, 
      total: total*1.25, 
      esSplit:false 
    }
    // Guardamos en TODAS las claves que tu facturador pueda leer
    localStorage.setItem("meijsac_transito_mesa", JSON.stringify(transito))
    localStorage.setItem("meijsac_transito_factura", JSON.stringify(transito))
    localStorage.setItem("meijsac_factura_desde_restaurante", JSON.stringify(transito))
    localStorage.setItem("meijsac_restaurante_comanda", JSON.stringify(transito))
    setMesas(prev=>prev.map(m=> m.id===mesaActiva? {...m, estado:"CUENTA" as const}:m))
    // Redirección forzada
    window.location.href="/dashboard/factura-xml"
  }

  const cierreRapido = () => { if(!mesa) return; const ventas = JSON.parse(localStorage.getItem("meijsac_ventas_rapidas")||"[]"); ventas.push({fecha:new Date().toISOString(), mesa:mesa.id, total:total*1.25, items:mesa.items}); localStorage.setItem("meijsac_ventas_rapidas", JSON.stringify(ventas)); setMesas(prev=>prev.map(m=> m.id===mesaActiva? {...m, estado:"SUCIA" as const}:m)) }

  const confirmarSplitIguales = () => {
    if(!mesa || numPartes <2) return
    const basePorParte = total / numPartes
    const pool: SplitFactura[] = Array.from({length:numPartes}, (_,i)=>({ id: genId(), mesaOrigenId: mesa.id, numero: i+1, totalPartes: numPartes, items: mesa.items, subtotal: parseFloat(basePorParte.toFixed(2)), iva: parseFloat((basePorParte*0.15).toFixed(2)), propina: parseFloat((basePorParte*0.10).toFixed(2)), total: parseFloat((basePorParte*1.25).toFixed(2)), esSplit: true, estado: "PENDIENTE", cliente:{nombre:`CONSUMIDOR FINAL MESA ${mesa.id} - Parte ${i+1}/${numPartes}`, ruc:"9999999999999"}, origen:`Mesa ${mesa.id}` }))
    localStorage.setItem("meijsac_split_pool", JSON.stringify(pool)); 
    localStorage.setItem("meijsac_transito_mesa", JSON.stringify({...pool[0], mesaId: mesa.id, mesaNombre: mesa.nombre})); 
    localStorage.setItem("meijsac_transito_factura", JSON.stringify(pool[0])); 
    localStorage.setItem("meijsac_factura_desde_restaurante", JSON.stringify(pool[0])); 
    setShowSplitIguales(false); 
    window.location.href="/dashboard/factura-xml"
  }

  const abrirSplitItems = () => { if(!mesa || mesa.items.length===0) return; setBandejas([[], []]); setShowSplitItems(true) }

  const confirmarSplitItems = () => {
    if(!mesa) return; const bandejasConItems = bandejas.filter(b=>b.length>0); if(bandejasConItems.length===0) { alert("Mueve al menos un plato"); return }
    const pool: SplitFactura[] = bandejasConItems.map((bandeja, i)=>{ const sub = bandeja.reduce((s,it)=>s+it.precio*it.cant,0); return { id: genId(), mesaOrigenId: mesa.id, numero: i+1, totalPartes: bandejasConItems.length, items: bandeja, subtotal: sub, iva: sub*0.15, propina: sub*0.10, total: sub*1.25, esSplit:true, estado:"PENDIENTE", cliente:{nombre:`MESA ${mesa.id} - Parte ${i+1}`, ruc:"9999999999999"}, origen:`Mesa ${mesa.id}` }})
    localStorage.setItem("meijsac_split_pool", JSON.stringify(pool)); 
    localStorage.setItem("meijsac_transito_mesa", JSON.stringify({...pool[0], mesaId: mesa.id, mesaNombre: mesa.nombre})); 
    localStorage.setItem("meijsac_transito_factura", JSON.stringify(pool[0])); 
    localStorage.setItem("meijsac_factura_desde_restaurante", JSON.stringify(pool[0])); 
    setShowSplitItems(false); 
    window.location.href="/dashboard/factura-xml"
  }

  const agregarMesa = () => {
    if(!nuevaMesa.nombre.trim()){ alert("Nombre requerido"); return }
    const nueva = { id: Date.now(), nombre: nuevaMesa.nombre.trim(), zona: nuevaMesa.zona, estado:"LIBRE", mesero:"", inicio:null, items:[], tiempo:0 } as Mesa
    setMesas(prev=>[...prev, nueva]); setShowAddMesa(false); setMesaActiva(nueva.id)
  }

  const confirmarLiberar = () => {
    if (!mesa) return;
    setMesas(prev => prev.map(m => m.id === mesaActiva? {...m, estado: "LIBRE", mesero: "", inicio: null, items: [], tiempo: 0 } : m));
    setShowLib(false);
  }

  return (
  <div className="min-h-screen bg-[#080c14] text-white flex">
    <div className="w-[30%] bg-[#0f172a] border-r border-white/10 p-3">
      <button onClick={() => window.location.href = "/dashboard/restaurante"} className="bg-white hover:bg-gray-200 text-black font-black text-xs px-4 py-2 rounded-lg mb-4 w-fit flex items-center">← Volver a Restaurante Hub</button>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-black text-[11px]">SALÓN EN VIVO {mesas.filter(m=>m.estado==="OCUPADA").length} ocupadas</h2>
        <button onClick={()=>setModoEdicionMesas(!modoEdicionMesas)} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${modoEdicionMesas?"bg-yellow-500 text-black":"bg-white/10"}`}>⚙️</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {mesas.map(m=>{
          const isCuenta = m.estado==="CUENTA"
          const isSucia = m.estado==="SUCIA"
          const isOcupadaAlerta = m.estado==="OCUPADA" && m.tiempo>120
          let c = ""
          if(m.estado==="LIBRE") c="bg-blue-500/20 border-blue-500/30"
          else if(m.estado==="OCUPADA") c=`bg-green-500/20 border-green-500/40 ${isOcupadaAlerta? "border-red-500/80" : ""}`
          else if(isCuenta) c="bg-yellow-500/30 border-yellow-500/60"
          else c="bg-red-500/20 border-red-500/30"

          return (
            <div key={m.id} className="relative">
              <button onClick={()=>{ if(!modoEdicionMesas) setMesaActiva(m.id) }} className={`p-3 rounded-xl border text-left w-full ${c} ${mesaActiva===m.id?"outline outline-2 outline-white" : ""}`}>
                <div className="flex justify-between items-center">
                  <div className="font-black text-sm">{m.nombre}</div>
                  {isCuenta && <span className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]"></span>}
                  {isOcupadaAlerta && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>}
                  {isSucia && <span className="w-2.5 h-2.5 bg-red-400 rounded-full"></span>}
                </div>
                <div className="text-[9px]">{m.zona} {m.tiempo>0?`${m.tiempo}min`:""}</div>
                <div className="text-[9px] mt-1 font-bold">{m.estado}</div>
              </button>
              {modoEdicionMesas && m.estado!== "OCUPADA" && m.estado!== "SUCIA" && (
                <button onClick={()=> setMesas(prev=>prev.filter(x=>x.id!==m.id))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-[10px] flex items-center justify-center font-black">✕</button>
              )}
            </div>
          )
        })}
        {modoEdicionMesas && (
          <button onClick={()=>setShowAddMesa(true)} className="p-3 rounded-xl border-2 border-dashed border-blue-500/50 bg-blue-500/10 text-left flex flex-col justify-center items-center">
            <div className="font-black text-xs text-blue-400">+ Añadir Mesa</div>
          </button>
        )}
      </div>
    </div>

    <div className="w-[45%] bg-[#1e293b] p-4 flex flex-col">
      <div className="flex justify-between border-b border-white/10 pb-3 mb-3">
        <div><h1 className="font-black">{mesa?.nombre} - <span className={mesa?.estado==="CUENTA"?"text-yellow-300":mesa?.estado==="OCUPADA"?"text-green-300":mesa?.estado==="SUCIA"?"text-red-300":"text-blue-300"}>{mesa?.estado}</span></h1><p className="text-[10px] opacity-50">{pendientes.length>0? `${pendientes.length} pendientes por enviar` : "Todo enviado"}</p></div>
        <button onClick={()=>setShowLib(true)} className="bg-white/10 px-3 py-1 rounded text-xs">Liberar</button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {mesa?.items.map((it, index)=>(
          <div key={`${it.uid}-${index}`} className={`p-3 rounded-xl border ${it.estado==="ENVIADO"?"bg-black/20 opacity-70":"bg-white/5"}`}>
            <div className="flex justify-between"><b className="text-sm">{it.cant}x {it.nombre} {it.estado==="PENDIENTE" && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded ml-2">PENDIENTE</span>}</b><span className="font-black text-[#00f5d4]">${(it.precio*it.cant).toFixed(2)}</span></div>
            <div className="text-[11px] text-orange-300 mt-1">
              {it.mods.termino && <div>- Término: {it.mods.termino}</div>}
              {it.mods.acomp && <div>- Con: {it.mods.acomp}</div>}
              {it.mods.nota && <div className="italic text-white/60">"{it.mods.nota}"</div>}
            </div>
            {it.estado==="PENDIENTE" && <button onClick={()=>setMesas(prev=>prev.map(m=>m.id===mesaActiva?{...m, items:m.items.filter(x=>x.uid!==it.uid)}:m))} className="text-[10px] text-red-400 mt-1">✕ Quitar</button>}
          </div>
        ))}
      </div>
      <button
        onClick={enviarLoteACocina}
        disabled={pendientes.length===0}
        className={`w-full py-3 rounded-xl font-black text-sm mt-3 flex items-center justify-center gap-2 ${pendientes.length>0? "bg-blue-500 text-white hover:bg-blue-600" : "bg-white/10 opacity-50"}`}
      >
        <span className={`${pendientes.length>0? "animate-pulse" : ""}`}>🔔</span>
        ENVIAR A COCINA ({pendientes.length})
      </button>
      {mesa?.estado==="SUCIA"? (
        <button onClick={()=>setShowLib(true)} className="w-full py-5 bg-red-500 text-white font-black rounded-2xl text-lg mt-3 flex items-center justify-center gap-2">
          <span className="animate-pulse">🧹</span> LIMPIAR MESA {mesaActiva} - LIBERAR
        </button>
      ) : (
        <div className="bg-black/60 p-4 rounded-2xl mt-3 border border-white/10">
          <div className="text-[11px] space-y-1"><div className="flex justify-between"><span>Subtotal</span><span>${total.toFixed(2)}</span></div><div className="flex justify-between"><span>IVA 15%</span><span>${(total*0.15).toFixed(2)}</span></div><div className="flex justify-between"><span>Propina 10%</span><span className="text-[#00f5d4]">${(total*0.10).toFixed(2)}</span></div><div className="flex justify-between font-black text-lg border-t border-white/10 pt-2"><span>TOTAL</span><span>${(total*1.25).toFixed(2)}</span></div></div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={preCuenta} className="bg-yellow-500/20 border border-yellow-500/40 py-3 rounded-xl font-black text-xs">PRE-CUENTA TÉRMICA</button>
            <button onClick={cierreRapido} className="bg-white/10 py-3 rounded-xl font-bold text-xs">⚡ CIERRE RÁPIDO</button>
            <button onClick={()=>{ setNumPartes(2); setShowSplitIguales(true)}} className="bg-[#7c3aed] py-3 rounded-xl font-black text-xs">DIVIDIR IGUALES</button>
            <button onClick={abrirSplitItems} className="bg-[#ff6b00] text-black py-3 rounded-xl font-black text-xs">DIVIDIR POR PLATOS</button>
            <button onClick={facturarSRI} className="col-span-2 bg-[#00f5d4] text-black py-3 rounded-xl font-black text-xs">FACTURAR SRI →</button>
          </div>
        </div>
      )}
    </div>

    <div className="w-[25%] bg-[#080c14] border-l border-white/10 p-3 flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-black opacity-40 tracking-widest">CATEGORIAS / BODEGAS</span>
        <button onClick={()=>setModoEdicionMenu(!modoEdicionMenu)} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${modoEdicionMenu?"bg-[#00f5d4] text-black":"bg-white/10"}`}>⚙️️</button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {categoriasMenu.map((c:string)=>(
          <div key={c} className="relative">
            <button onClick={()=>setCatActiva(c)} className={`px-3 py-1.5 rounded-full text-[10px] font-black border ${catActiva===c?"bg-[#00f5d4] text-black border-[#00f5d4]":"bg-white/10 border-white/10"}`}>{c}</button>
            {modoEdicionMenu && (
              <button onClick={()=>{ if(!confirm(`¿Eliminar categoría ${c}?`)) return; setCategoriasMenu(categoriasMenu.filter(x=>x!==c)); if(catActiva===c) setCatActiva(categoriasMenu[0]||"") }} className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full text-[8px] flex items-center justify-center font-black">✕</button>
            )}
          </div>
        ))}
        {modoEdicionMenu && <button onClick={()=>setShowAddCategoria(true)} className="px-3 py-1.5 rounded-full text-[10px] font-black border border-dashed border-[#00f5d4]/50 text-[#00f5d4] bg-[#00f5d4]/5">+ Nueva Cat</button>}
      </div>
      <div className="grid grid-cols-2 gap-2 overflow-y-auto">
        {MENU.filter((p:any)=>p.cat===catActiva).map((plato:any)=>(
          <div key={plato.id} className="relative">
            <button onClick={()=>{
              if(modoEdicionMenu) return
              const nuevoItem = { uid: genId(), nombre: plato.nombre, precio: plato.precio, cant:1, destino: plato.destino, estado:"PENDIENTE", mods:{termino:"", acomp:"", nota:""} } as any
              setMesas(prev=>prev.map(m=>m.id===mesaActiva?{...m, items:[...m.items, nuevoItem], estado:"OCUPADA"}:m))
            }} className={`w-full p-3 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-white/10 ${modoEdicionMenu?"opacity-60":""}`}>
              <div className="font-bold text-xs leading-tight">{plato.nombre}</div>
              <div className="text-[10px] text-[#00f5d4] font-black mt-1">${plato.precio.toFixed(2)} - {plato.destino}</div>
            </button>
            {modoEdicionMenu && <button onClick={()=>{ if(!confirm(`¿Desactivar ${plato.nombre}?`)) return; setMenuRestaurante(prev=>prev.map(p=>p.id===plato.id?{...p, activo:false}:p)) }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-[10px] font-black flex items-center justify-center">✕</button>}
          </div>
        ))}
        {modoEdicionMenu && <button onClick={()=>{ setNuevoPlato({...nuevoPlato, cat:catActiva}); setShowAddPlato(true) }} className="p-3 rounded-xl border-2 border-dashed border-[#00f5d4]/50 bg-[#00f5d4]/5 flex flex-col items-center justify-center min-h-[70px]"><div className="text-[#00f5d4] font-black text-xs">+ Añadir Plato</div></button>}
      </div>
    </div>

    {showAddMesa && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><div className="bg-[#0f172a] w-full max-w-sm rounded-2xl p-6 border border-blue-500/30"><h2 className="font-black text-blue-300">+ Añadir Nueva Mesa</h2><input placeholder="Mesa 13..." value={nuevaMesa.nombre} onChange={e=>setNuevaMesa({...nuevaMesa, nombre:e.target.value})} className="w-full bg-black border border-white/10 p-3 rounded-xl text-sm mt-4" /><div className="flex gap-2 mt-6"><button onClick={()=>setShowAddMesa(false)} className="flex-1 bg-white/10 py-3 rounded-xl">Cancelar</button><button onClick={agregarMesa} className="flex-1 bg-blue-500 text-white font-black py-3 rounded-xl">CREAR MESA</button></div></div></div>}
    {showSplitIguales && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><div className="bg-[#0f172a] w-full max-w-sm rounded-2xl p-6 border border-[#7c3aed]/50"><h2 className="font-black text-[#a78bfa]">Dividir iguales</h2><input type="number" min={2} max={8} value={numPartes} onChange={e=>setNumPartes(parseInt(e.target.value)||2)} className="w-full bg-black border border-white/20 p-4 rounded-xl text-center text-2xl font-black mt-4" /><div className="flex gap-2 mt-6"><button onClick={()=>setShowSplitIguales(false)} className="flex-1 bg-white/10 py-3 rounded-xl">Cancelar</button><button onClick={confirmarSplitIguales} className="flex-1 bg-[#7c3aed] text-white font-black py-3 rounded-xl">GENERAR {numPartes} →</button></div></div></div>}
    {showSplitItems && <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"><div className="bg-[#0f172a] w-full max-w-4xl rounded-2xl p-6 border border-orange-500/30 max-h-[90vh] overflow-hidden flex flex-col"><h2 className="font-black text-orange-400">Dividir por Platos</h2><div className="grid grid-cols-3 gap-4 mt-4 flex-1 overflow-hidden"><div className="bg-black/40 rounded-xl p-3 overflow-y-auto"><h3 className="font-black text-[11px] mb-2">PLATOS MESA {mesaActiva}</h3>{mesa?.items.map(it=><button key={it.uid} onClick={()=>{ setBandejas(prev=>{ const n=[...prev.map(x=>[...x])]; if(!n[0].some(x=>x.uid===it.uid)) n[0].push(it); return n })}} className="w-full text-left bg-white/5 border border-white/10 p-2 rounded-xl mb-2"><div className="text-xs font-bold">{it.nombre}</div></button>)}</div>{bandejas.map((b,i)=><div key={i} className="bg-[#7c3aed]/10 border border-[#7c3aed]/30 rounded-xl p-3 overflow-y-auto"><div className="flex justify-between items-center mb-2"><h3 className="font-black text-[11px]">FACTURA {i+1}</h3><span className="text-[10px] bg-[#7c3aed] px-2 py-1 rounded-full">${b.reduce((s,i)=>s+i.precio,0).toFixed(2)}</span></div>{b.map(it=><div key={it.uid} className="bg-black/50 p-2 rounded-xl mb-2"><div className="text-xs">{it.nombre}</div></div>)}</div>)}</div><div className="flex gap-2 mt-4 justify-end"><button onClick={()=>setShowSplitItems(false)} className="bg-white/10 px-6 py-3 rounded-xl">Cerrar</button></div></div></div>}
    {showLib && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><div className="bg-[#0f172a] w-full max-w-sm rounded-2xl p-6 border border-red-500/30"><h2 className="font-black text-red-400">¿Liberar {mesa?.nombre}?</h2><div className="flex gap-2 mt-6"><button onClick={()=>setShowLib(false)} className="flex-1 bg-white/10 py-3 rounded-xl">No</button><button onClick={confirmarLiberar} className="flex-1 bg-red-500 text-white font-black py-3 rounded-xl">Sí, Liberar</button></div></div></div>}
    {showAddPlato && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"><div className="bg-[#0f172a] w-full max-w-md rounded-2xl p-6 border border-[#00f5d4]/30"><h2 className="font-black text-[#00f5d4]">+ NUEVO PLATO - {catActiva}</h2><input placeholder="Nombre" value={nuevoPlato.nombre} onChange={e=>setNuevoPlato({...nuevoPlato, nombre:e.target.value})} className="w-full bg-black border border-white/10 p-3 rounded-xl text-sm mt-4" /><div className="flex gap-2 mt-6"><button onClick={()=>setShowAddPlato(false)} className="flex-1 bg-white/10 py-3 rounded-xl">Cancelar</button><button onClick={()=>{ if(!nuevoPlato.nombre||!nuevoPlato.precio){ alert("Falta nombre y precio"); return } const nuevo = { id: Date.now(), nombre: nuevoPlato.nombre, precio: Number(nuevoPlato.precio), cat: nuevoPlato.cat || catActiva, destino: nuevoPlato.destino, activo:true, iva:nuevoPlato.iva, mods:[] }; setMenuRestaurante(prev=>[...prev, nuevo]); setNuevoPlato({nombre:"", precio:0, cat:catActiva, destino:"WOK", iva:15}); setShowAddPlato(false)}} className="flex-1 bg-[#00f5d4] text-black py-3 rounded-xl font-black">GUARDAR</button></div></div></div>}
  </div>
  )
}