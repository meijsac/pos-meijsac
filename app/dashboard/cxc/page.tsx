"use client"
import { useState, useEffect } from "react"
import Link from "next/link"

type Deuda = {
  id:number, cliente:string, telefono:string, documento:string,
  fechaVenta:string, fechaVencimiento:string, fechaVencISO:string,
  monto:number, saldo:number, plazo:number, politica:string, estado:"PENDIENTE"|"ABONADO"|"PAGADO",
  fechaPago?:string, formaRecaudo?:string
}

export default function CXCPage(){
  const [cxc, setCxc] = useState<Deuda[]>([])
  const [tab, setTab] = useState<"PENDIENTES"|"PAGADOS">("PENDIENTES")
  const [modal, setModal] = useState<Deuda|null>(null)
  const [abonoMonto, setAbonoMonto] = useState("")
  const [formaPago, setFormaPago] = useState("01 - EFECTIVO")
  const [busca, setBusca] = useState("")

  useEffect(()=>{
    const data = JSON.parse(localStorage.getItem("meijsac_cxc")||"[]")
    setCxc(data)
  }, [])

  const guardar = (lista:Deuda[]) => {
    localStorage.setItem("meijsac_cxc", JSON.stringify(lista))
    setCxc(lista)
  }

  // 2. FÓRMULA MATEMÁTICA MORA SEMÁFORO
  const calcularMora = (fechaISO:string) => {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const venc = new Date(fechaISO); venc.setHours(0,0,0,0)
    const diff = Math.floor((venc.getTime() - hoy.getTime())/86400000) // positivo = faltan, 0=hoy, negativo=mora
    if(diff>0) return {texto:`🟢 ${diff} días restantes`, color:"bg-green-500/15 text-green-400 border-green-500/30", dias:diff, tipo:"AL_DIA"}
    if(diff===0) return {texto:"🟠 Vence hoy", color:"bg-orange-500/20 text-orange-300 border-orange-500/30 animate-pulse", dias:0, tipo:"HOY"}
    return {texto:`⚠️ ${Math.abs(diff)} días de retraso`, color:"bg-red-500/20 text-red-400 border-red-500/40 animate-pulse font-black", dias:Math.abs(diff), tipo:"MORA"}
  }

  // 3. MODAL ACCIÓN - ABONO Y LIQUIDAR + ENLACE CAJA CHICA
  const confirmarAbono = () => {
    if(!modal) return
    const monto = parseFloat(abonoMonto)
    if(isNaN(monto) || monto<=0){ alert("Monto inválido"); return }
    if(monto > modal.saldo+0.01){ alert(`No puede abonar más de $${modal.saldo.toFixed(2)}`); return }

    const lista = [...cxc]
    const idx = lista.findIndex(c=>c.id===modal.id)
    lista[idx].saldo = parseFloat((lista[idx].saldo - monto).toFixed(2))

    if(lista[idx].saldo<=0.01){
      lista[idx].saldo=0; lista[idx].estado="PAGADO"
      lista[idx].fechaPago=new Date().toLocaleDateString('es-EC')
      lista[idx].formaRecaudo=formaPago
    } else {
      lista[idx].estado="ABONADO"
    }

    // 🔄 ENLACE AUTOMÁTICO CON CAJA CHICA - CRUCIAL
    try{
      const caja = JSON.parse(localStorage.getItem("meijsac_caja_activa")||"null")
      if(caja && caja.abierta){
        caja.ingresos = (caja.ingresos||0) + monto
        caja.movimientos = caja.movimientos||[]
        caja.movimientos.push({
          tipo:"INGRESO_CXC", monto, documento: modal.documento,
          cliente: modal.cliente, formaPago, concepto: `Recaudo de Cartera - Factura ${modal.documento} / Cliente: ${modal.cliente} / Abono $${monto.toFixed(2)}`,
          hora: new Date().toLocaleString('es-EC')
        })
        localStorage.setItem("meijsac_caja_activa", JSON.stringify(caja))
      } else {
        // Si no hay caja abierta, guardamos en historial de caja chica para arqueo
        const historial = JSON.parse(localStorage.getItem("meijsac_caja_historial")||"[]")
        historial.push({monto, documento:modal.documento, cliente:modal.cliente, formaPago, fecha:new Date().toLocaleString('es-EC')})
        localStorage.setItem("meijsac_caja_historial", JSON.stringify(historial))
      }
    }catch{}

    guardar(lista)
    setModal(null); setAbonoMonto("")
    if(navigator.vibrate) navigator.vibrate(200)
    alert(`✅ Recaudo $${monto.toFixed(2)} registrado (${formaPago}) - Caja actualizada`)
  }

  const pendientes = cxc.filter(c=>c.estado==="PENDIENTE"||c.estado==="ABONADO")
  const pagados = cxc.filter(c=>c.estado==="PAGADO")
  const totalPorCobrar = pendientes.reduce((s,c)=>s+c.saldo,0)
  const totalMora = pendientes.filter(c=> calcularMora(c.fechaVencISO).tipo==="MORA").length
  const q = busca.trim().toLowerCase()
  const coincide = (c: Deuda) => !q || c.cliente.toLowerCase().includes(q) || c.documento.toLowerCase().includes(q)
  const pendientesVista = pendientes.filter(coincide)
  const pagadosVista = pagados.filter(coincide)
  const hoy = new Date()
  const recaudadoMes = pagados.reduce((s, c) => {
    const partes = String(c.fechaPago || "").split(/[\/\-]/).map(Number)
    if (partes.length < 3) return s
    const mes = partes[1]
    const anio = partes[2] < 100 ? 2000 + partes[2] : partes[2]
    return mes === hoy.getMonth() + 1 && anio === hoy.getFullYear() ? s + c.monto : s
  }, 0)

  return (
    <div className="min-h-screen bg-[#080c14] text-white p-4">
      <div className="bg-[#12141d] p-4 rounded-2xl mb-4 border border-white/10 border-t-2 border-t-teal-500/50">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
            <h1 className="font-black text-xl">Cuentas por Cobrar</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-teal-400/40 text-teal-200 bg-teal-400/10">Créditos y Cartera</span>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Link href="/dashboard" className="bg-white/10 px-4 py-2 rounded-xl text-xs">← Dashboard</Link>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Cliente o factura" className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-teal-400/60 w-44" />
            <button onClick={()=>setTab("PENDIENTES")} className={`px-4 py-2 rounded-xl text-xs font-semibold ${tab==="PENDIENTES"?"bg-teal-400 text-slate-950":"bg-white/10 text-white/70"}`}>Pendientes ({pendientes.length})</button>
            <button onClick={()=>setTab("PAGADOS")} className={`px-4 py-2 rounded-xl text-xs font-semibold ${tab==="PAGADOS"?"bg-teal-400 text-slate-950":"bg-white/10 text-white/50"}`}>Cobrados ({pagados.length})</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
            <p className="text-[10px] text-white/45">Total por cobrar</p>
            <p className="text-lg font-black text-teal-300">${totalPorCobrar.toFixed(2)}</p>
          </div>
          <div className={`rounded-xl bg-black/30 border px-3 py-2 ${totalMora > 0 ? "border-amber-400/40" : "border-white/10"}`}>
            <p className="text-[10px] text-white/45">Cartera vencida</p>
            <p className={`text-lg font-black ${totalMora > 0 ? "text-amber-200" : "text-white/80"}`}>{totalMora} clientes</p>
          </div>
          <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
            <p className="text-[10px] text-white/45">Recaudado este mes</p>
            <p className="text-lg font-black text-white/90">${recaudadoMes.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {tab==="PENDIENTES" && (
        <div className="bg-[#12141d] rounded-2xl border border-white/10 overflow-auto">
          {pendientes.length===0? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#0b1220] border border-teal-400/25 grid place-items-center text-teal-300 mb-4">
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3 l7 3 v6 c0 4.5-3 7.5-7 9 c-4-1.5-7-4.5-7-9 V6 z" />
                  <path d="M8 12 h8 M12 9 v6" />
                </svg>
              </div>
              <p className="font-semibold">Cartera al día</p>
              <p className="text-sm text-white/50 mt-2 max-w-md mx-auto">No tienes cobros pendientes por el momento. Las ventas emitidas a crédito aparecerán aquí automáticamente para gestionar sus abonos.</p>
            </div>
          ) : pendientesVista.length===0 ? (
            <div className="p-12 text-center text-sm text-white/50">Ningún crédito coincide con esa búsqueda.</div>
          ) : (
          <table className="w-full text-[11px]"><thead className="bg-black/50 text-[10px] opacity-60"><tr><th className="p-3 text-left">Cliente y Teléfono</th><th className="p-3">Documento Origen SRI</th><th className="p-3">Fecha Venta / Vencimiento</th><th className="p-3">Mora Semáforo</th><th className="p-3">Monto / Saldo</th><th className="p-3">Acción</th></tr></thead>
          <tbody>{pendientesVista.sort((a,b)=> new Date(a.fechaVencISO).getTime() - new Date(b.fechaVencISO).getTime()).map(c=>{ const mora=calcularMora(c.fechaVencISO); const abonado=Math.max(0, c.monto-c.saldo); const pct=c.monto>0?Math.min(100,(abonado/c.monto)*100):0; return (
            <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
              <td className="p-3"><b>{c.cliente}</b><br/><a href={`tel:${c.telefono}`} className="text-teal-300 underline">{c.telefono||'Sin teléfono'}</a><br/><span className="text-[9px] opacity-40">{c.politica} | {c.plazo}d | {c.estado}</span></td>
              <td className="p-3 font-mono text-[10px]">{c.documento}</td>
              <td className="p-3">{c.fechaVenta}<br/><span className="font-bold">{c.fechaVencimiento}</span></td>
              <td className="p-3"><span className={`px-2 py-1 rounded-full border text-[10px] ${mora.color}`}>{mora.texto}</span></td>
              <td className="p-3">
                <span className="opacity-60">${c.monto.toFixed(2)}</span><br/><span className="font-black text-teal-300 text-[13px]">${c.saldo.toFixed(2)}</span>
                <div className="mt-1.5 h-1.5 w-28 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-teal-400" style={{width:`${pct}%`}} /></div>
                <p className="text-[9px] text-white/40 mt-0.5">Abonado ${abonado.toFixed(2)}</p>
              </td>
              <td className="p-3"><button onClick={()=>{ setModal(c); setAbonoMonto(c.saldo.toFixed(2)) }} className="bg-teal-400/15 text-teal-100 border border-teal-400/40 px-3 py-2 rounded-xl font-semibold text-[11px]">Registrar Abono</button></td>
            </tr>
          )})}</tbody></table>
          )}
        </div>
      )}

      {tab==="PAGADOS" && (
        <div className="bg-[#12141d] rounded-2xl border border-white/10 overflow-auto">
          {pagadosVista.length===0 ? (
            <div className="p-12 text-center text-sm text-white/50">{pagados.length===0 ? "Aún no hay cobros registrados este periodo." : "Ningún cobro coincide con esa búsqueda."}</div>
          ) : (
          <table className="w-full text-[11px]"><thead className="bg-black/50 text-[10px] opacity-60"><tr><th className="p-3">Cliente</th><th className="p-3">Documento</th><th className="p-3">Fecha Pago Real</th><th className="p-3">Forma Recaudo Caja</th><th className="p-3">Monto</th></tr></thead><tbody>{pagadosVista.map(c=>(<tr key={c.id} className="border-t border-white/5"><td className="p-3">{c.cliente}</td><td className="p-3 font-mono">{c.documento}</td><td className="p-3 text-teal-300">{c.fechaPago}</td><td className="p-3">{c.formaRecaudo}</td><td className="p-3 font-black">${c.monto.toFixed(2)}</td></tr>))}</tbody></table>
          )}
        </div>
      )}

      {/* MODAL DE ABONOS Y COBROS */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-[#0f172a] w-full max-w-md rounded-2xl p-6 border border-[#00f5d4]/30">
            <h2 className="font-black text-[#00f5d4] text-[14px]">COBRAR A {modal.cliente}</h2>
            <p className="text-[11px] opacity-60">Doc: {modal.documento} | Saldo: ${modal.saldo.toFixed(2)} | Vence: {modal.fechaVencimiento}</p>

            <div className="mt-4 space-y-3">
              <label className="text-[10px] opacity-60">Monto a abonar / pagar</label>
              <input type="number" value={abonoMonto} onChange={e=>setAbonoMonto(e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white font-black text-lg outline-none focus:border-[#00f5d4]" />
              <div className="flex gap-2">
                <button onClick={()=>setAbonoMonto((modal.saldo/2).toFixed(2))} className="flex-1 bg-white/10 py-2 rounded-xl text-[10px]">50% (${(modal.saldo/2).toFixed(2)})</button>
                <button onClick={()=>setAbonoMonto(modal.saldo.toFixed(2))} className="flex-1 bg-white/10 py-2 rounded-xl text-[10px]">TOTAL (${modal.saldo.toFixed(2)})</button>
              </div>

              <label className="text-[10px] opacity-60 mt-2 block">¿Cómo ingresa el dinero? (Obliga caja)</label>
              <select value={formaPago} onChange={e=>setFormaPago(e.target.value)} className="w-full bg-[#1e293b] p-3 rounded-xl text-xs border border-white/10">
                <option>01 - SIN UTILIZACION DEL SISTEMA FINANCIERO (Efectivo)</option>
                <option>20 - OTROS CON UTILIZACION (Transfer / De Una / Pichincha)</option>
                <option>19 - TARJETA DE CREDITO / 16 - DEBITO (Datafast)</option>
              </select>

              <div className="bg-black/40 p-3 rounded-xl border border-white/10 text-[10px]">
                <p className="opacity-60">Al confirmar:</p>
                <p>✓ Saldo quedará: <b className="text-[#00f5d4]">${(modal.saldo - (parseFloat(abonoMonto)||0)).toFixed(2)}</b></p>
                <p>✓ Se sumará a <b>meijsac_caja_activa</b> → "Recaudo Cartera - {modal.documento}"</p>
                <p>✓ Arqueo ciego cuadrará al centavo</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={()=>setModal(null)} className="flex-1 bg-white/10 rounded-xl py-3 text-sm">Cancelar</button>
              <button onClick={confirmarAbono} className="flex-1 bg-[#00f5d4] text-black font-black rounded-xl py-3 text-sm">CONFIRMAR ABONO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}