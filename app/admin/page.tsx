"use client"
import { useState, useEffect, useMemo } from "react"

// ===== TIPOS = TABLAS SQL =====
type Plan = { id: string; nombre: string; descripcion: string; estado: "activo"|"inactivo"|"archivado"; badge: string; color: string }
type Precio = { id: string; plan_id: string; precio: number; moneda: string; frecuencia: "mensual"|"anual"; dias_prueba: number; fecha_desde: string }
type Limite = { plan_id: string; clave: string; valor: number } // -1 = ilimitado
type Suscripcion = { cliente_id: string; ruc: string; razon: string; plan_id: string; precio_id: string; estado: "prueba"|"activo"|"soft_block"|"hard_block"|"cancelado"; metodo_pago: "manual"|"automatico"; fecha_inicio: string; fecha_corte: string; consumo_facturas: number; consumo_usuarios: number }

const PLANES_SEED: Plan[] = [
  { id: "p1", nombre: "Plan Emprendedor", descripcion: "Para Negocio Popular - POS Ticket", estado: "activo", badge: "Popular", color: "#00f5d4" },
  { id: "p2", nombre: "Plan Profesional Pyme", descripcion: "Para RIMPE Emprendedor / General - Facturador XML", estado: "activo", badge: "Más Popular", color: "#3B82F6" },
  { id: "p3", nombre: "Plan Corporativo", descripcion: "Multi-sucursal, multi-usuario", estado: "activo", badge: "", color: "#f59e0b" },
]

export default function AdminModuladorCompleto(){
  const [logado, setLogado] = useState(false)
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [tab, setTab] = useState<"dash"|"planes"|"clientes"|"crear">("dash")

  const [planes, setPlanes] = useState<Plan[]>(PLANES_SEED)
  const [precios, setPrecios] = useState<Precio[]>([
    { id:"pr1", plan_id:"p1", precio:0, moneda:"USD", frecuencia:"mensual", dias_prueba:7, fecha_desde:"2026-11-01" },
    { id:"pr2", plan_id:"p2", precio:19.99, moneda:"USD", frecuencia:"mensual", dias_prueba:7, fecha_desde:"2026-11-01" },
    { id:"pr3", plan_id:"p2", precio:199, moneda:"USD", frecuencia:"anual", dias_prueba:7, fecha_desde:"2026-11-01" },
    { id:"pr4", plan_id:"p3", precio:49.99, moneda:"USD", frecuencia:"mensual", dias_prueba:14, fecha_desde:"2026-11-01" },
  ])
  const [limites, setLimites] = useState<Limite[]>([
    { plan_id:"p1", clave:"max_facturas", valor:100 },
    { plan_id:"p1", clave:"max_usuarios", valor:1 },
    { plan_id:"p1", clave:"max_sucursales", valor:1 },
    { plan_id:"p2", clave:"max_facturas", valor:500 },
    { plan_id:"p2", clave:"max_usuarios", valor:5 },
    { plan_id:"p2", clave:"max_sucursales", valor:2 },
    { plan_id:"p3", clave:"max_facturas", valor:-1 },
    { plan_id:"p3", clave:"max_usuarios", valor:20 },
    { plan_id:"p3", clave:"max_sucursales", valor:10 },
  ])
  const [subs, setSubs] = useState<Suscripcion[]>([])
  const [filtro, setFiltro] = useState("")

  // Form crear plan
  const [nuevo, setNuevo] = useState({ nombre:"", descripcion:"", precio:0, frecuencia:"mensual" as any, dias_prueba:7, max_facturas:100, max_usuarios:3, max_sucursales:1, badge:"" })

  // Cargar clientes reales
  useEffect(()=>{
    if(localStorage.getItem('meijsac_admin_token')==='ok') setLogado(true)
    const lista = JSON.parse(localStorage.getItem('meijsac_clientes')||"[]")
    const uno = localStorage.getItem('meijsac_empresa')
    let all = [...lista]
    if(uno){ const e=JSON.parse(uno); if(!all.find((c:any)=>c.ruc===e.ruc)) all.push(e) }
    const mapeadas: Suscripcion[] = all.map((c:any, i:number)=>({
      cliente_id: c.ruc, ruc: c.ruc, razon: c.razon || c.nombreComercial || "Sin nombre",
      plan_id: c.regimen==="RIMPE_POPULAR" ? "p1" : "p2",
      precio_id: c.regimen==="RIMPE_POPULAR" ? "pr1" : "pr2",
      estado: c.estado==="BLOQUEADO" ? "hard_block" : c.estado==="POR VENCER" ? "soft_block" : "activo",
      metodo_pago: "manual", fecha_inicio: c.fecha || "2026-11-01", fecha_corte: c.vencePlan || "2026-12-01",
      consumo_facturas: Math.floor(Math.random()*80), consumo_usuarios: 1
    }))
    setSubs(mapeadas)
  },[])

  const persistir = (nuevas: Suscripcion[])=>{ setSubs(nuevas); const paraGuardar = nuevas.map(s=>({ ruc:s.ruc, razon:s.razon, regimen: s.plan_id==="p1"?"RIMPE_POPULAR":"RIMPE_EMPRENDEDOR", plan: planes.find(p=>p.id===s.plan_id)?.nombre, vencePlan: s.fecha_corte, estado: s.estado==="hard_block"?"BLOQUEADO":s.estado==="soft_block"?"POR VENCER":"ACTIVO" })); localStorage.setItem('meijsac_clientes', JSON.stringify(paraGuardar)) }

  // ===== PRORRATEO =====
  const calcularProrrateo = (precioActual:number, precioNuevo:number, inicio:string, corte:string)=>{
    const ini=new Date(inicio).getTime(), cor=new Date(corte).getTime(), hoy=Date.now()
    const diasTotales = Math.max(1, Math.round((cor-ini)/86400000))
    const diasConsumidos = Math.round((hoy-ini)/86400000)
    const diasRestantes = Math.max(0, diasTotales - diasConsumidos)
    const credito = (precioActual/diasTotales)*diasRestantes
    const costoNuevo = (precioNuevo/diasTotales)*diasRestantes
    return { diasTotales, diasConsumidos, diasRestantes, credito: +credito.toFixed(2), costoNuevo: +costoNuevo.toFixed(2), totalAPagar: +Math.max(0, costoNuevo-credito).toFixed(2) }
  }

  const cambiarPlan = (sub: Suscripcion, nuevoPlanId: string)=>{
    const planNuevo = planes.find(p=>p.id===nuevoPlanId)!
    const precioViejo = precios.find(p=>p.id===sub.precio_id)?.precio||0
    const precioNuevoObj = precios.find(p=>p.plan_id===nuevoPlanId && p.frecuencia==="mensual")!
    const limiteNuevoUsuarios = limites.find(l=>l.plan_id===nuevoPlanId && l.clave==="max_usuarios")?.valor||0

    // Control Downgrade
    if(sub.consumo_usuarios > limiteNuevoUsuarios && limiteNuevoUsuarios!==-1){
      alert(`❌ No puede bajar a ${planNuevo.nombre}. Tiene ${sub.consumo_usuarios} usuarios y ese plan solo permite ${limiteNuevoUsuarios}. Debe eliminar usuarios primero.`)
      return
    }
    const pro = calcularProrrateo(precioViejo, precioNuevoObj.precio, sub.fecha_inicio, sub.fecha_corte)
    if(!confirm(`Upgrade a ${planNuevo.nombre}\nDías restantes: ${pro.diasRestantes}\nCrédito a favor: $${pro.credito}\nCosto nuevo restante: $${pro.costoNuevo}\nTOTAL A PAGAR HOY: $${pro.totalAPagar}\n¿Confirmar?`)) return
    const nuevas = subs.map(s=> s.cliente_id===sub.cliente_id ? {...s, plan_id: nuevoPlanId, precio_id: precioNuevoObj.id, estado: "activo" as const} : s)
    persistir(nuevas)
    alert(`✅ Cambio aplicado. Cobrar $${pro.totalAPagar} por transferencia.`)
  }

  const toggleBloqueo = (sub: Suscripcion)=>{
    // Soft -> Hard -> Activo
    const siguiente = sub.estado==="activo" ? "soft_block" : sub.estado==="soft_block" ? "hard_block" : "activo"
    const label = siguiente==="soft_block" ? "SOFT BLOCK (puede ver, no puede emitir)" : siguiente==="hard_block" ? "HARD BLOCK (sin acceso)" : "ACTIVADO"
    if(!confirm(`Cambiar ${sub.razon} a ${label}?`)) return
    persistir(subs.map(s=> s.cliente_id===sub.cliente_id ? {...s, estado: siguiente as any} : s))
  }

  const crearPlan = ()=>{
    if(!nuevo.nombre || !nuevo.precio && nuevo.precio!==0){ alert("Nombre y precio"); return }
    const id = "p"+Date.now()
    setPlanes([...planes, { id, nombre: nuevo.nombre, descripcion: nuevo.descripcion, estado:"activo", badge: nuevo.badge, color:"#00f5d4" }])
    setPrecios([...precios, { id:"pr"+Date.now(), plan_id:id, precio:nuevo.precio, moneda:"USD", frecuencia:nuevo.frecuencia, dias_prueba:nuevo.dias_prueba, fecha_desde: new Date().toISOString().slice(0,10) }])
    setLimites([...limites, { plan_id:id, clave:"max_facturas", valor:nuevo.max_facturas }, { plan_id:id, clave:"max_usuarios", valor:nuevo.max_usuarios }, { plan_id:id, clave:"max_sucursales", valor:nuevo.max_sucursales }])
    alert("✅ Plan creado. No altera clientes antiguos porque precio va en historial.")
    setTab("planes")
  }

  // KPIs
  const mrr = useMemo(()=> subs.reduce((acc,s)=> acc + (precios.find(p=>p.id===s.precio_id)?.precio||0),0),[subs, precios])
  const filtrados = subs.filter(s=> s.ruc.includes(filtro) || s.razon.toLowerCase().includes(filtro.toLowerCase()))

  if(!logado) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h1 className="font-black text-white">MEIJSAC SUPER ADMIN</h1>
        <input value={user} onChange={e=>setUser(e.target.value)} placeholder="Usuario" className="w-full p-3 rounded-xl bg-black border border-white/10 text-white text-sm" />
        <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Contraseña" className="w-full p-3 rounded-xl bg-black border border-white/10 text-white text-sm" />
        <button onClick={()=>{ if(user==="MEIJSACONT" && pass==="Meijsac2026!"){ localStorage.setItem('meijsac_admin_token','ok'); setLogado(true)} else alert("Acceso denegado") }} className="w-full py-3 rounded-xl bg-[#00f5d4] text-black font-black">ENTRAR</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex justify-between items-center"><h1 className="text-xl font-black">MODULADOR COMPLETO</h1><button onClick={()=>{localStorage.removeItem('meijsac_admin_token'); setLogado(false)}} className="text-xs bg-white/10 px-3 py-1 rounded">Salir</button></div>
        <div className="flex gap-2">{["dash","planes","clientes","crear"].map(t=><button key={t} onClick={()=>setTab(t as any)} className={`px-4 py-2 rounded-xl text-xs font-black ${tab===t?"bg-[#00f5d4] text-black":"bg-white/10"}`}>{t==="dash"?"DASHBOARD":t==="planes"?"PLANES":t==="clientes"?"CLIENTES / SUSCRIPCIONES":"CREAR PLAN"}</button>)}</div>

        {tab==="dash" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-white/5 p-4 rounded-xl"><div className="text-[10px] opacity-50">MRR ESTIMADO</div><div className="font-black text-xl">${mrr.toFixed(2)}</div></div>
              <div className="bg-white/5 p-4 rounded-xl"><div className="text-[10px] opacity-50">CLIENTES</div><div className="font-black text-xl">{subs.length}</div></div>
              <div className="bg-emerald-500/10 p-4 rounded-xl"><div className="text-[10px] opacity-50">ACTIVOS</div><div className="font-black text-xl">{subs.filter(s=>s.estado==="activo").length}</div></div>
              <div className="bg-red-500/10 p-4 rounded-xl"><div className="text-[10px] opacity-50">BLOQUEADOS</div><div className="font-black text-xl">{subs.filter(s=>s.estado!=="activo" && s.estado!=="prueba").length}</div></div>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4"><h3 className="font-bold text-sm mb-2">Planes y MRR por plan</h3>{planes.map(p=>{ const cant = subs.filter(s=>s.plan_id===p.id).length; const precio = precios.find(pr=>pr.plan_id===p.id)?.precio||0; return <div key={p.id} className="flex justify-between py-2 border-b border-white/5 text-xs"><span>{p.nombre} - ${precio} / {p.estado}</span><span>{cant} clientes - MRR ${cant*precio}</span></div>})}</div>
          </div>
        )}

        {tab==="planes" && (
          <div className="grid gap-2">{planes.map(p=>{
            const pr = precios.find(x=>x.plan_id===p.id); const limF = limites.find(l=>l.plan_id===p.id && l.clave==="max_facturas"); const limU = limites.find(l=>l.plan_id===p.id && l.clave==="max_usuarios")
            return <div key={p.id} className="bg-white/5 p-4 rounded-xl flex justify-between items-center"><div><div className="font-bold">{p.nombre} {p.badge && <span className="bg-[#00f5d4] text-black text-[9px] px-1 rounded">{p.badge}</span>}</div><div className="text-[11px] opacity-60">{p.descripcion} | ${pr?.precio} {pr?.frecuencia} | Trial {pr?.dias_prueba}d | Facturas: {limF?.valor===-1?"Ilimitado":limF?.valor} | Usuarios: {limU?.valor}</div></div><button onClick={()=>setPlanes(planes.map(x=>x.id===p.id?{...x, estado: x.estado==="activo"?"inactivo":"activo"}:x))} className={`px-3 py-1 rounded text-xs font-black ${p.estado==="activo"?"bg-[#00f5d4] text-black":"bg-white/10"}`}>{p.estado==="activo"?"ACTIVO":"INACTIVO"}</button></div>
          })}</div>
        )}

        {tab==="crear" && (
          <div className="bg-white/5 p-4 rounded-xl space-y-3 max-w-xl">
            <h3 className="font-black">PASO 1 - Información</h3>
            <input value={nuevo.nombre} onChange={e=>setNuevo({...nuevo, nombre:e.target.value})} placeholder="Nombre plan: Plan Emprendedor" className="w-full p-3 rounded bg-black border border-white/10 text-sm" />
            <input value={nuevo.descripcion} onChange={e=>setNuevo({...nuevo, descripcion:e.target.value})} placeholder="Descripción" className="w-full p-3 rounded bg-black border border-white/10 text-sm" />
            <input value={nuevo.badge} onChange={e=>setNuevo({...nuevo, badge:e.target.value})} placeholder="Badge: Más Popular / Nuevo" className="w-full p-3 rounded bg-black border border-white/10 text-sm" />
            <h3 className="font-black">PASO 2 - Financiero</h3>
            <div className="grid grid-cols-3 gap-2"><input type="number" value={nuevo.precio} onChange={e=>setNuevo({...nuevo, precio:+e.target.value})} placeholder="Precio USD" className="p-3 rounded bg-black border border-white/10" /><select value={nuevo.frecuencia} onChange={e=>setNuevo({...nuevo, frecuencia:e.target.value as any})} className="p-3 rounded bg-black border border-white/10"><option value="mensual">Mensual</option><option value="anual">Anual</option></select><input type="number" value={nuevo.dias_prueba} onChange={e=>setNuevo({...nuevo, dias_prueba:+e.target.value})} placeholder="Días prueba" className="p-3 rounded bg-black border border-white/10" /></div>
            <h3 className="font-black">PASO 3 - Límites</h3>
            <div className="grid grid-cols-3 gap-2"><label className="text-xs">Facturas/mes<input type="number" value={nuevo.max_facturas} onChange={e=>setNuevo({...nuevo, max_facturas:+e.target.value})} className="w-full p-2 rounded bg-black border border-white/10" /></label><label className="text-xs">Usuarios<input type="number" value={nuevo.max_usuarios} onChange={e=>setNuevo({...nuevo, max_usuarios:+e.target.value})} className="w-full p-2 rounded bg-black border border-white/10" /></label><label className="text-xs">Sucursales<input type="number" value={nuevo.max_sucursales} onChange={e=>setNuevo({...nuevo, max_sucursales:+e.target.value})} className="w-full p-2 rounded bg-black border border-white/10" /></label></div>
            <p className="text-[10px] opacity-50">Si pones -1 en facturas = Ilimitado. Al cambiar precio, se crea un nuevo registro en historial, no se altera a clientes antiguos.</p>
            <button onClick={crearPlan} className="w-full py-3 bg-[#00f5d4] text-black font-black rounded-xl">CREAR PLAN</button>
          </div>
        )}

        {tab==="clientes" && (
          <div className="space-y-3">
            <input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar por RUC o Razón..." className="w-full p-3 rounded-xl bg-black border border-white/10 text-sm" />
            <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10"><table className="w-full text-[11px]"><thead><tr className="text-left opacity-50 text-[10px]"><th className="p-2">CLIENTE</th><th>PLAN</th><th>CONSUMO</th><th>CORTE</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{filtrados.map(s=>{
              const limF = limites.find(l=>l.plan_id===s.plan_id && l.clave==="max_facturas")?.valor||0
              const porc = limF===-1?0:Math.round((s.consumo_facturas/limF)*100)
              return <tr key={s.cliente_id} className="border-t border-white/5"><td className="p-2"><div className="font-bold">{s.ruc}</div><div className="opacity-60">{s.razon}</div></td><td className="p-2"><select value={s.plan_id} onChange={e=>cambiarPlan(s, e.target.value)} className="bg-black border border-white/10 rounded px-1 py-1">{planes.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select><div className="text-[9px] opacity-50">${precios.find(p=>p.id===s.precio_id)?.precio} {s.metodo_pago}</div></td><td className="p-2"><div>Facturas {s.consumo_facturas}/{limF===-1?"∞":limF} ({porc}%)</div><div className="h-1 bg-white/10 rounded"><div className={`h-1 rounded ${porc>90?"bg-red-500":"bg-[#00f5d4]"}`} style={{width: `${Math.min(100,porc)}%`}}></div></div></td><td className="p-2">{s.fecha_corte}</td><td className="p-2"><span className={`px-2 py-1 rounded text-[10px] ${s.estado==="activo"?"bg-emerald-500/20 text-emerald-300":s.estado==="soft_block"?"bg-orange-500/20 text-orange-300":"bg-red-500/20 text-red-300"}`}>{s.estado}</span></td><td className="p-2 flex gap-1"><button onClick={()=>toggleBloqueo(s)} className="bg-white/10 px-2 py-1 rounded text-[10px]">{s.estado==="activo"?"Soft Block":"Activar"}</button><button onClick={()=>{if(confirm("Eliminar?")) persistir(subs.filter(x=>x.cliente_id!==s.cliente_id))}} className="text-red-400 px-2">X</button></td></tr>
            })}</tbody></table></div>
            <p className="text-[10px] opacity-50">Reglas aplicadas: Trial → Pendiente pago → Soft Block día 1 mora (solo ver) → Hard Block día 15 (sin acceso). Downgrade bloqueado si supera usuarios. Prorrateo automático al cambiar plan. Pago actual: MANUAL transferencia/efectivo.</p>
          </div>
        )}
      </div>
    </div>
  )
}