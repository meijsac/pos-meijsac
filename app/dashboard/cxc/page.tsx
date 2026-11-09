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

  return (
    <div className="min-h-screen bg-[#080c14] text-white p-4">
      <div className="flex justify-between bg-[#1e293b] p-4 rounded-2xl mb-4 border border-white/10">
        <div>
          <h1 className="font-black text-xl">CUENTAS POR COBRAR (CXC) - SRI FormaPago 20</h1>
          <p className="text-[10px] opacity-50">Por cobrar: ${totalPorCobrar.toFixed(2)} | En mora: {totalMora} clientes | Lector activo</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="bg-white/10 px-4 py-2 rounded-xl text-xs">← Dashboard</Link>
          <button onClick={()=>setTab("PENDIENTES")} className={`px-4 py-2 rounded-xl text-xs font-black ${tab==="PENDIENTES"?"bg-white text-black":"bg-white/10"}`}>PENDIENTES ({pendientes.length})</button>
          <button onClick={()=>setTab("PAGADOS")} className={`px-4 py-2 rounded-xl text-xs font-black ${tab==="PAGADOS"?"bg-[#00f5d4] text-black":"bg-white/10"}`}>COBRADOS ({pagados.length})</button>
        </div>
      </div>

      {tab==="PENDIENTES" && (
        <div className="bg-[#1e293b] rounded-2xl border border-white/10 overflow-auto">
          {pendientes.length===0? (
            <div className="p-20 text-center opacity-40"><p className="text-4xl mb-2">📭</p><p>Cartera al día - PENDIENTES (0)</p><p className="text-[10px] mt-2">Cuando des clic en Confirmar Crédito en POS, aparecerá aquí automático</p></div>
          ) : (
          <table className="w-full text-[11px]"><thead className="bg-black/50 text-[10px] opacity-60"><tr><th className="p-3 text-left">Cliente y Teléfono</th><th className="p-3">Documento Origen SRI</th><th className="p-3">Fecha Venta / Vencimiento</th><th className="p-3">Mora Semáforo</th><th className="p-3">Monto / Saldo</th><th className="p-3">Acción</th></tr></thead>
          <tbody>{pendientes.sort((a,b)=> new Date(a.fechaVencISO).getTime() - new Date(b.fechaVencISO).getTime()).map(c=>{ const mora=calcularMora(c.fechaVencISO); return (
            <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
              <td className="p-3"><b>{c.cliente}</b><br/><a href={`tel:${c.telefono}`} className="text-[#00f5d4] underline">{c.telefono||'Sin teléfono'}</a><br/><span className="text-[9px] opacity-40">{c.politica} | {c.plazo}d | {c.estado}</span></td>
              <td className="p-3 font-mono text-[10px]">{c.documento}</td>
              <td className="p-3">{c.fechaVenta}<br/><span className="font-bold">{c.fechaVencimiento}</span></td>
              <td className="p-3"><span className={`px-2 py-1 rounded-full border text-[10px] ${mora.color}`}>{mora.texto}</span></td>
              <td className="p-3"><span className="opacity-60">${c.monto.toFixed(2)}</span><br/><span className="font-black text-[#00f5d4] text-[13px]">${c.saldo.toFixed(2)}</span></td>
              <td className="p-3"><button onClick={()=>{ setModal(c); setAbonoMonto(c.saldo.toFixed(2)) }} className="bg-[#00f5d4] text-black px-3 py-2 rounded-xl font-black text-[11px] hover:scale-105">Abono / Pagar</button></td>
            </tr>
          )})}</tbody></table>
          )}
        </div>
      )}

      {tab==="PAGADOS" && (
        <div className="bg-[#1e293b] rounded-2xl border border-white/10 overflow-auto">
          <table className="w-full text-[11px]"><thead className="bg-black/50 text-[10px] opacity-60"><tr><th className="p-3">Cliente</th><th className="p-3">Documento</th><th className="p-3">Fecha Pago Real</th><th className="p-3">Forma Recaudo Caja</th><th className="p-3">Monto</th></tr></thead><tbody>{pagados.map(c=>(<tr key={c.id} className="border-t border-white/5"><td className="p-3">{c.cliente}</td><td className="p-3 font-mono">{c.documento}</td><td className="p-3 text-green-400">{c.fechaPago}</td><td className="p-3">{c.formaRecaudo}</td><td className="p-3 font-black">${c.monto.toFixed(2)}</td></tr>))}</tbody></table>
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