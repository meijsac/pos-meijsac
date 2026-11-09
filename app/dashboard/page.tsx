"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { cargarEmpresaSesion } from "@/lib/sesion-cliente"

const CORPORATE = "#23AAB3"

const modules = [
  { title: "CONFIGURACIÓN", desc: "Datos de tu empresa, RUC, firma y SRI", href: "/dashboard/configuracion", icon: "⚙️", size: "col-span-1", primary: false },
  { title: "COMPROBANTES ELECTRÓNICOS", desc: "Facturas, NC, ND, Guías y SRI", href: "/dashboard/comprobantes", icon: "📄", size: "col-span-1", primary: true },
  { title: "POS TICKET", desc: "Punto de venta rápido sin firma", href: "/dashboard/pos-ticket", icon: "🧾", size: "col-span-1", primary: false },
  { title: "RESTAURANTE POS", desc: "Mesas, comandas, cocina", href: "/dashboard/restaurante", icon: "🍽️", size: "col-span-1", primary: true },
  { title: "CONTABILIDAD", desc: "Libro diario, mayor y estados", href: "/dashboard/contabilidad", icon: "📊", size: "col-span-1", primary: false },
  { title: "CUENTAS POR COBRAR", desc: "Cartera, mora, abonos y crédito", href: "/dashboard/cxc", icon: "💳", size: "col-span-1", primary: false },
  { title: "INVENTARIO", desc: "Productos, stock, kardex", href: "/dashboard/productos", icon: "📦", size: "col-span-1", primary: false },
  { title: "CAJA", desc: "Apertura, cierre y arqueo", href: "/dashboard/caja", icon: "💰", size: "col-span-1", primary: false },
  { title: "CLIENTES", desc: "Gestión y políticas de crédito", href: "/dashboard/clientes", icon: "👥", size: "col-span-1", primary: false },
  { title: "REPORTES", desc: "Ventas, SRI, utilidades", href: "/dashboard/reportes", icon: "📈", size: "col-span-1", primary: false },
  { title: "COMPROBANTES ADICIONALES", desc: "Proformas, historias, recetas", href: "/dashboard/comprobantes-adicionales", icon: "📋", size: "col-span-1", primary: true },
]

function getDias(vence: string){
  const diff = new Date(vence).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000*60*60*24))
}
function getColor(dias: number){
  if(dias < 0) return { bg: "bg-red-500/10 border-red-500/20 text-red-400", dot: "bg-red-500", label: "VENCIDO" }
  if(dias <= 15) return { bg: "bg-orange-400/10 border-orange-400/20 text-orange-300", dot: "bg-orange-400", label: `VENCE EN ${dias}D` }
  return { bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300", dot: "bg-emerald-400", label: "ACTIVO" }
}

type Serie = { dia: number[]; semana: number[]; mes: number[]; año: number[] }
type Metrica = { ventas: number; pedidos: number; carrito: number }

function BarrasColoresCompact({ series }: { series: Serie }){
  const [filtro, setFiltro] = useState<'dia'|'semana'|'mes'|'año'>('dia')
  const values = series[filtro] || []
  const max = Math.max(...values, 0)
  const vacio = max <= 0
  const colors = ['#ff7a7a','#c5b3ff','#ff8a8a','#ff9f6e','#ffd76e','#ffe08a','#a0e8a0','#23AAB3','#e879f9','#60a5fa']
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-[#12141d] p-3 h-[72px] overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <p className="text-[8px] opacity-40 tracking-widest font-bold">MOVIMIENTOS</p>
        <div className="flex gap-1 bg-black/40 rounded-full p-0.5 border border-white/5">
          {(['dia','semana','mes','año'] as const).map(f=>(
            <button key={f} onClick={()=>setFiltro(f)} className={`text-[7px] px-2 py-0.5 rounded-full font-bold uppercase transition-all ${filtro===f ? 'bg-white text-black' : 'text-white/40'}`}>{f}</button>
          ))}
        </div>
      </div>
      {vacio ? <p className="text-[10px] opacity-50">Sin movimientos aún</p> : (
        <div className="flex items-end gap-[3px] h-[30px]">
          {values.map((v,i)=>{
            const h = (v/max)*100
            return <div key={i} className="flex-1 rounded-t-[4px] transition-all duration-500" style={{ height: `${Math.max(h, v > 0 ? 8 : 0)}%`, background: colors[i%colors.length] }} />
          })}
        </div>
      )}
    </div>
  )
}

function VentasAreaCompact({ series, metricas }: { series: Serie; metricas: Record<string, Metrica> }){
  const [filtro, setFiltro] = useState<'dia'|'semana'|'mes'|'año'>('mes')
  const [tab, setTab] = useState(0)
  const m = metricas[filtro] || { ventas: 0, pedidos: 0, carrito: 0 }
  const tabs = [
    { label: 'Ventas', value: `$${m.ventas.toFixed(2)}` },
    { label: 'Pedidos', value: String(m.pedidos) },
    { label: 'Valor carrito', value: m.pedidos ? `$${m.carrito.toFixed(2)}` : '$0.00' },
  ]
  const points = series[filtro] || []
  const max = Math.max(...points, 0)
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-[#12141d] overflow-hidden h-[108px] flex flex-col">
      <div className="flex justify-end gap-1 px-2 pt-1">
        {(['dia','semana','mes','año'] as const).map(f => (
          <button key={f} onClick={()=>setFiltro(f)} className={`text-[7px] px-2 py-0.5 rounded-full font-bold uppercase ${filtro===f ? 'bg-white text-black' : 'text-white/40'}`}>{f}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 border-b border-white/[0.06]">
        {tabs.map((t,i)=>(
          <button key={t.label} onClick={()=>setTab(i)} className={`p-1.5 text-left border-r border-white/[0.04] last:border-0 ${tab===i ? 'bg-[#0f6cb6] text-white' : 'text-white/30 hover:text-white/60'}`}>
            <p className="text-[7px] font-bold truncate">{t.label}</p>
            <p className="text-[10px] font-black truncate">{t.value}</p>
          </button>
        ))}
      </div>
      <div className="flex-1 relative px-2">
        {max <= 0 ? <p className="text-[10px] opacity-50 pt-2">Sin movimientos aún</p> : (
          <svg viewBox="0 0 1000 40" className="w-full h-[28px]">
            <polyline fill="none" stroke="#1f7fcf" strokeWidth="2" points={points.map((v,i)=> `${points.length === 1 ? 0 : (i/(points.length-1))*1000},${40 - (v/max)*34}`).join(' ')} />
          </svg>
        )}
      </div>
    </div>
  )
}

export default function DashboardMeijsac(){
  const [firmaSubida, setFirmaSubida] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [porCobrar, setPorCobrar] = useState(0)
  const [ventas, setVentas] = useState({ hoy: 0, mes: 0, pedidosHoy: 0, pedidosMes: 0 })
  const [docsLegales, setDocsLegales] = useState<{ id: string; tipo: string; nombre: string; fecha_caducidad: string }[]>([])
  const vacioSerie = { dia: [], semana: [], mes: [], año: [] }
  const [series, setSeries] = useState<Serie>(vacioSerie)
  const [metricas, setMetricas] = useState<Record<string, Metrica>>({})
  const router = useRouter()
  const [bg, setBg] = useState<{type:'color'|'image', value:string}>({type:'color', value:'#090b11'})
  const [showBg, setShowBg] = useState(false)
  // === AQUI VA LO REAL - DENTRO DEL COMPONENTE ===
  const [miSuscripcion, setMiSuscripcion] = useState<any>(null)
  const [accesoPlan, setAccesoPlan] = useState<any>(null)
  const [firmaMock, setFirmaMock] = useState({ vence: "", titular: "" })
  const [planMock, setPlanMock] = useState({ vence: "", nombre: "" })
  const [userMock, setUserMock] = useState({ razon: "Cargando...", ruc: "", logo: "" })
  
  useEffect(()=>{
    setMounted(true)
    const savedBg = localStorage.getItem('meijsac_bg')
    if(savedBg){ try{ setBg(JSON.parse(savedBg)) }catch{} }
    const firmaGuardada = localStorage.getItem('meijsac_firma') || localStorage.getItem('meijsac_config_pro')
    const cfgPro = firmaGuardada ? JSON.parse(firmaGuardada) : null
    if(localStorage.getItem('meijsac_firma') || cfgPro?.firma?.nombre){
      setFirmaSubida(true)
    }

    let cancel = false
    ;(async () => {
      try {
        const e = await cargarEmpresaSesion()
        if (cancel) return
        setUserMock({ razon: e.razon || e.razonSocial || e.nombreComercial || "Sin nombre", ruc: e.ruc || "", logo: e.logo_url || e.logoUrl || "" })
        if (cfgPro?.firma?.expira) setFirmaMock({ vence: cfgPro.firma.expira, titular: e.razon })
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 8000)
        try {
          const res = await fetch(`/api/empresa/estado?ruc=${encodeURIComponent(e.ruc)}`, { signal: ctrl.signal })
          const data = res.ok ? await res.json() : null
          if (!cancel && data) {
            setAccesoPlan(data)
            if (data.firmaExpira) setFirmaMock({ vence: data.firmaExpira, titular: e.razon })
            if (data.vence) setPlanMock({ vence: String(data.vence).slice(0, 10), nombre: data.planNombre || "PLAN DE PRUEBA" })
          }
        } catch (err: any) {
          if (!cancel && err?.name === "AbortError") {
            setUserMock((u) => ({ ...u, razon: u.ruc ? u.razon : "Tiempo agotado al cargar la empresa" }))
          }
        } finally {
          clearTimeout(timer)
        }
        const headers = { Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` }
        const [resumenRes, docsRes] = await Promise.all([
          fetch("/api/dashboard/resumen", { headers }),
          fetch("/api/documentos-legales", { headers }),
        ])
        if (!cancel && resumenRes.ok) {
          const resumen = await resumenRes.json()
          setVentas({ hoy: Number(resumen.ventasHoy || 0), mes: Number(resumen.ventasMes || 0), pedidosHoy: Number(resumen.pedidosHoy || 0), pedidosMes: Number(resumen.pedidosMes || 0) })
          setPorCobrar(Number(resumen.cxc || 0))
          if (resumen.series) setSeries(resumen.series)
          if (resumen.metricas) setMetricas(resumen.metricas)
        }
        if (!cancel && docsRes.ok) {
          const lista = await docsRes.json()
          if (Array.isArray(lista)) setDocsLegales(lista)
        }
      } catch (err: any) {
        if (!cancel) setUserMock({ razon: err?.message || "No se pudo cargar la empresa", ruc: "", logo: "" })
      }
    })()
    return () => { cancel = true }
  },[])

  const saveBg = (newBg:any)=>{
    setBg(newBg)
    localStorage.setItem('meijsac_bg', JSON.stringify(newBg))
  }

  const diasFirma = firmaMock.vence ? getDias(firmaMock.vence) : null
  const diasPlan = planMock.vence ? getDias(planMock.vence) : null
  const colFirma = diasFirma === null ? null : getColor(diasFirma)
  const colPlan = diasPlan === null ? null : getColor(diasPlan)
  const inicial = (userMock.razon || "E").trim().charAt(0).toUpperCase()
  const docsVista = [
    ...(firmaMock.vence && !docsLegales.some((d) => d.tipo === "Firma Electrónica") ? [{ id: "firma-config", tipo: "Firma Electrónica", nombre: "Firma Electrónica", fecha_caducidad: String(firmaMock.vence).slice(0, 10) }] : []),
    ...docsLegales,
  ]
  const etiquetaDoc = (vence: string) => {
    const dias = Math.ceil((new Date(vence).getTime() - Date.now()) / 86400000)
    if (dias < 0) return { clase: "text-red-300", texto: `VENCIDO - Venció hace ${Math.abs(dias)} días` }
    if (dias <= 30) return { clase: "text-amber-300", texto: `POR VENCER - Faltan ${dias} días` }
    return { clase: "text-emerald-300", texto: `AL DÍA - Vence en ${dias} días` }
  }
  const estaBloqueado = accesoPlan ? accesoPlan.estado === "BLOQUEADO" : miSuscripcion?.estado === "BLOQUEADO"
  const estaPorVencer = accesoPlan ? false : miSuscripcion?.estado === "POR VENCER"

  return (
    <div className="min-h-screen text-white p-4 md:p-6 selection:bg-white selection:text-black pb-[20px]"
      style={{ background: bg.type === 'color' ? bg.value : `url(${bg.value}) center/cover no-repeat fixed` }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
        *{font-family:'Inter', sans-serif}
        .card{transition: all .5s cubic-bezier(.16,1,.3,1)}
        .card:hover{transform: translateY(-4px) scale(1.01)}
        @media (max-height: 900px){
          .fit-screen{ transform: scale(0.97) scaleX(1.06); transform-origin: top center; margin-bottom: -4vh; width: 98%; }
        }
        @media (max-height: 800px){
          .fit-screen{ transform: scale(0.94) scaleX(1.06); transform-origin: top center; margin-bottom: -6vh; width: 98%; }
        }
      `}</style>

      <div className="fit-screen">
        {/* AVISO FIRMA - ROJO BAJITO Y PEQUEÑO */}
{!firmaSubida && (
  <div className="max-w-[1600px] mx-auto mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex justify-between items-center">
    <p className="text-[11px] text-red-700">
      <b>⚠️ Falta subir tu firma electrónica</b> <span className="text-red-500">— Sin firma no puedes facturar al SRI.</span>
    </p>
    <a href="/dashboard/configuracion" className="bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[10px] px-3 py-1.5 rounded-full whitespace-nowrap border border-red-200">
      SUBIR FIRMA →
    </a>
  </div>
)}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl grid place-items-center font-black text-lg" style={{background: CORPORATE}}>M</div>
            <h1 className="text-[22px] font-black">MEIJSAC</h1>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-full bg-white text-black grid place-items-center text-[22px] font-black overflow-hidden shrink-0">
              {userMock.logo ? <img src={userMock.logo} alt="" className="w-full h-full object-contain" /> : inicial}
            </div>
            <div className="min-w-0">
              <p className="text-[18px] font-black leading-tight">{userMock.razon}</p>
              <p className="text-[14px] leading-tight">RUC: {userMock.ruc || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {colFirma && <div className={`text-[9px] px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${colFirma.bg}`}><span className={`w-1.5 h-1.5 rounded-full animate-pulse ${colFirma.dot}`}></span> FIRMA {colFirma.label}</div>}
            {colPlan && <div className={`text-[9px] px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${colPlan.bg}`}><span className={`w-1.5 h-1.5 rounded-full animate-pulse ${colPlan.dot}`}></span> {accesoPlan?.planNombre || "PLAN"} · {colPlan.label}</div>}
            <div className="flex items-center gap-2 bg-[#12141d] border border-white/10 rounded-full pl-1 pr-1 py-1 relative">
              <button onClick={()=>setShowBg(!showBg)} className="text-[8px] bg-white/5 hover:bg-white/15 border border-white/10 px-2.5 py-1 rounded-full font-bold transition">🎨 Fondo</button>
              <button onClick={()=>{ localStorage.clear(); window.location.href = "/"; }} className="text-[8px] bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1 rounded-full font-bold transition">Cerrar sesión</button>
              {showBg && (
                <div className="absolute right-0 top-[40px] w-[290px] bg-[#12141d] border border-white/10 rounded-2xl p-4 z-50 shadow-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] font-black tracking-widest">FONDO DE PANTALLA</p>
                    <button onClick={()=>setShowBg(false)} className="text-[12px] opacity-40">✕</button>
                  </div>
                  <p className="text-[8px] opacity-40 mb-2">COLORES</p>
                  <div className="grid grid-cols-6 gap-2 mb-4">
                    {['#090b11','#0f172a','#134e4a','#1e1b4b','#000000','#23AAB3'].map(c=>(
                      <button key={c} onClick={()=>saveBg({type:'color', value:c})} className={`w-9 h-9 rounded-full border-2 transition ${bg.value===c ? 'border-white scale-110' : 'border-white/10'}`} style={{background:c}} />
                    ))}
                  </div>
                  <p className="text-[8px] opacity-40 mb-2">FOTO DE TU EMPRESA</p>
                  <label className="text-[9px] bg-white/[0.06] hover:bg-white/[0.10] border border-white/10 px-3 py-3 rounded-xl block text-center cursor-pointer transition">
                    📷 Subir imagen (local, bodega, equipo)
                    <input type="file" accept="image/*" className="hidden" onChange={(e)=>{
                      const file = e.target.files?.[0]; if(!file) return;
                      if(file.size > 2*1024*1024){ alert('Máx 2MB'); return; }
                      const reader = new FileReader(); 
                      reader.onload = ()=> saveBg({type:'image', value: reader.result as string}); 
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  <div className="flex gap-2 mt-3">
                    <button onClick={()=>saveBg({type:'color', value:'#090b11'})} className="flex-1 text-[8px] bg-white/5 py-2 rounded-full border border-white/10">Restaurar</button>
                    <button onClick={()=>setShowBg(false)} className="flex-1 text-[8px] bg-white text-black py-2 rounded-full font-black">Listo</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === BANNER DE BLOQUEO REAL - AQUI VA === */}
        {estaBloqueado && (
          <div className="max-w-[1600px] mx-auto mb-4 bg-red-500/20 border border-red-500 p-4 rounded-2xl text-center">
            <p className="font-black text-red-300">⛔ CUENTA SUSPENDIDA - HARD BLOCK</p>
            <p className="text-[11px] text-red-200">Contacta a MEIJSAC para reactivar tu plan. No puedes emitir comprobantes.</p>
          </div>
        )}
        {estaPorVencer && !estaBloqueado && (
          <div className="max-w-[1600px] mx-auto mb-4 bg-orange-500/20 border border-orange-500 p-4 rounded-2xl text-center">
            <p className="font-black text-orange-300">⚠️ SOLO LECTURA - SOFT BLOCK</p>
            <p className="text-[11px] text-orange-200">Puedes ver, pero no emitir. Tu plan venció.</p>
          </div>
        )}

        <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-3 mb-5">
          <div className="col-span-12 md:col-span-6 grid grid-cols-3 gap-3">
            <div className="bg-[#12141d] rounded-2xl border border-white/[0.05] p-3 shadow-sm flex flex-col justify-between h-[188px]">
              <div><p className="text-[9px] opacity-40 tracking-widest">VENTAS HOY</p><p className="text-[16px] font-black mt-1">${ventas.hoy.toFixed(2)}</p><p className="text-[9px] opacity-50 mt-1">{ventas.pedidosHoy} facturas autorizadas hoy</p><p className="text-[9px] opacity-50">Mes: ${ventas.mes.toFixed(2)} • {ventas.pedidosMes} autorizadas • CxC ${porCobrar.toFixed(2)}</p></div>
            </div>
            <div className="bg-[#12141d] rounded-2xl border border-white/[0.05] p-3 shadow-sm flex flex-col justify-between h-[188px]">
              <div><p className="text-[9px] opacity-40 tracking-widest">ESTADO FINANCIERO</p><p className="text-[13px] font-bold mt-3">Sin egresos registrados</p><p className="text-[9px] opacity-50 mt-1">Ingresos ${ventas.mes.toFixed(2)} - Egresos $0.00 (sin compras registradas)</p></div>
              <div><div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full w-0" style={{ background: CORPORATE }} /></div></div>
            </div>
            <div className="bg-[#12141d] rounded-2xl border border-white/[0.05] p-3 shadow-sm h-[188px]">
              <p className="text-[9px] opacity-40 tracking-widest mb-2">CUMPLIMIENTO DOCUMENTAL</p>
              <div className="space-y-1.5 overflow-auto max-h-[150px]">
                {docsVista.length === 0 ? (
                  <div className="text-[10px] leading-snug">
                    <p>No tienes documentos agregados. Agrega tus permisos en Configuración &gt; Documentos Legales</p>
                    <Link href="/dashboard/configuracion?tab=DOCUMENTOS" className="inline-block mt-2 bg-white text-black px-2 py-1 rounded-full font-black">Ir a Configuración</Link>
                  </div>
                ) : docsVista.map((d) => {
                  const est = etiquetaDoc(d.fecha_caducidad)
                  return (
                    <div key={d.id} className="text-[10px] bg-white/[0.03] px-2 py-1.5 rounded-xl border border-white/[0.05]">
                      <div className="font-bold">{d.nombre}</div>
                      <div className={est.clase}>{est.texto}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-6 flex flex-col gap-3 h-[188px]">
            <BarrasColoresCompact series={series} />
            <VentasAreaCompact series={series} metricas={metricas} />
          </div>
        </div>

        <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-[1600px] mx-auto ${estaBloqueado ? 'pointer-events-none opacity-40 grayscale' : ''}`}>
          {modules.map((m,i)=>{
            const isSide = m.title === "CONFIGURACIÓN" || m.title === "COMPROBANTES ELECTRÓNICOS"
            // Si es SOFT BLOCK, POS y COMPROBANTES no dejan entrar
            const bloqueadoPorSoft = estaPorVencer && (m.title.includes("COMPROBANTES") || m.title.includes("POS") || m.title.includes("RESTAURANTE"))
            const hrefFinal = bloqueadoPorSoft ? "#" : m.href
            return (
              <Link key={m.title} href={hrefFinal} onClick={(e)=>{ if(bloqueadoPorSoft){ e.preventDefault(); alert("SOLO LECTURA - Tu plan venció, no puedes emitir.") } }} className={`${m.size} group`}>
                <div className="card relative h-[118px] rounded-2xl p-[1px] overflow-hidden" style={{ opacity: mounted?1:0, transform: mounted? 'translateY(0)':'translateY(12px)', transitionDelay: `${i*15}ms` }}>
                  <div className="absolute inset-0 rounded-2xl" style={{ background: `linear-gradient(135deg, ${CORPORATE}, #0f4a4f)` }} />
                  <div className={`relative h-full w-full rounded-[15px] p-3.5 flex flex-col justify-between text-white`} style={{background: `radial-gradient(120% 120% at 0% 0%, ${CORPORATE} 0%, #0f4a4f 100%)`}}>
                    {isSide ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-[32px] leading-none w-9 h-9 grid place-items-center bg-white/15 rounded-full shrink-0">{m.icon}</span>
                          <h2 className="text-[13px] font-black leading-[1.05] flex-1">{m.title}</h2>
                          <span className="text-[10px] opacity-40 group-hover:translate-x-1 transition-transform shrink-0">→</span>
                        </div>
                        <div className="pl-[44px]"><p className={`text-[11px] leading-[1.1] opacity-70`}>{m.desc}</p></div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center"><span className="text-[32px] leading-none w-9 h-9 grid place-items-center bg-white/15 rounded-full shrink-0">{m.icon}</span><span className="text-[10px] opacity-40 group-hover:translate-x-1 transition-transform">→</span></div>
                        <div><h2 className="text-[13px] font-black leading-tight">{m.title}</h2><p className={`text-[11px] mt-1 leading-tight opacity-70`}>{m.desc}</p></div>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
        <p className="text-center text-[8px] opacity-20 tracking-[0.2em] mt-6">MEIJSAC - ESCRITORIO • CUMPLIMIENTO • FINANZAS</p>
      </div>
    </div>
  )
}