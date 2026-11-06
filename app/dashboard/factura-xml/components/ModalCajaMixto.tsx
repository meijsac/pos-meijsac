"use client"
import { useState, useMemo } from "react"

export default function ModalCajaMixto({ total, cliente, onConfirm, onClose }: any){
  // CAMBIA ESTAS LÍNEAS EN TU CÓDIGO ACTUAL:
const [tab, setTab] = useState("EFECTIVO")
const [efectivoMonto, setEfectivoMonto] = useState(0) // ➔ Cambiado de 20 a 0
const [conteo, setConteo] = useState<any>({})       // ➔ Cambiado de {"20":1} a {}

  const [transf, setTransf] = useState({monto: 0, comp: ""})
  
  // --- EXTENSIÓN DE TARJETA: DIFERIDOS Y FINANCIAMIENTO ---
  const [tarjeta, setTarjeta] = useState({ monto: 0, lote: "", tipo: "CREDITO", plan: "CORRIENTE", meses: 3 })
  const [credito, setCredito] = useState(0)

  // --- LÓGICA DE LÍMITES JALADA DE LA FICHA DEL CLIENTE ---
  const limiteCreditoDisponible = cliente?.limiteCredito || 200.00
  const diasCreditoAutorizados = cliente?.diasCredito || 30

  const totalBilletes = Object.entries(conteo).reduce((a:any,[b,c]:any)=>a+parseFloat(b)*Number(c||0),0)
  const baseEfectivo = totalBilletes > 0 ? totalBilletes : efectivoMonto
  
  // Sumatoria líquida de lo ingresado en el punto de venta
  const totalPagado = baseEfectivo + (transf?.monto || 0) + (tarjeta?.monto || 0) + (credito || 0)
  const diferencia = totalPagado - total

  const estado = useMemo(() => {
    if (diferencia < -0.01) return "FALTANTE"
    if (diferencia > 0.01) return "VUELTO"
    return "EXACTO"
  }, [diferencia])

  const vuelto = estado === "VUELTO" ? diferencia : 0
  const faltante = estado === "FALTANTE" ? Math.abs(diferencia) : 0
  
  // Cálculo preciso del residuo exacto que falta por pagar
  const saldoPorCubrir = Math.max(0, total - (totalPagado - (tab === "TARJETA" ? tarjeta.monto : tab === "TRANSF" ? transf.monto : tab === "CREDITO" ? credito : 0)))

  // --- ARREGLO DE CONTROL CONTABLE Y VALIDACIÓN DE RIESGO ---
  const superaLimiteCredito = credito > limiteCreditoDisponible

  // --- PROCESADOR MAESTRO DE DATOS CON CÓDIGOS SRI (TABLA 24) ---
  const procesarDesgloseSRI = () => {
    const listadoPagosSRI: any[] = [];

    if (baseEfectivo > 0) {
      // Al SRI solo se le reporta el total real de la factura cobrada en efectivo sin el vuelto
      const efectivoNeto = estado === "VUELTO" ? baseEfectivo - vuelto : baseEfectivo;
      listadoPagosSRI.push({ formaPago: "01", total: efectivoNeto }); // 01 = EFECTIVO
    }
    if (tarjeta.monto > 0) {
      listadoPagosSRI.push({
        formaPago: tarjeta.tipo === "CREDITO" ? "19" : "16", // 19 = Tarjeta Crédito, 16 = Débito
        total: tarjeta.monto,
        plazo: tarjeta.plan === "DIFERIDO" ? tarjeta.meses : 0,
        unidadTiempo: "meses"
      });
    }
    if (transf.monto > 0) {
      listadoPagosSRI.push({ formaPago: "20", total: transf.monto }); // 20 = Sistema Financiero (Transferencias/Deuna)
    }
    if (credito > 0) {
      listadoPagosSRI.push({
        formaPago: "20", // Código normado para financiamiento interno
        total: credito,
        plazo: diasCreditoAutorizados,
        unidadTiempo: "dias"
      });
    }

    // Disparamos la data unificada al facturador
    onConfirm(
      { efectivo: { monto: baseEfectivo, cambio: vuelto }, transf, tarjeta, credito },
      listadoPagosSRI // ¡INYECCIÓN COMPLETA DIRECTA AL XML DEL SRI!
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur z-[150] flex items-center justify-center p-3">
      <div className="bg-[#0f1b2e] w-full max-w-[500px] rounded-[20px] border border-cyan-500/20 overflow-hidden text-white">
        <div className="p-5 pb-3">
          <h2 className="font-black text-[#00f5d4] text-sm tracking-wide">CAJA ABIERTA - MULTIMEDIOS MIXTO</h2>
          <div className="flex justify-between bg-black/50 p-3 rounded-xl mt-3 text-[11px] border border-white/10 items-center">
            <div>Total: <b>${total.toFixed(2)}</b> | Pagado: <b className="text-[#00f5d4]">${totalPagado.toFixed(2)}</b></div>
            <div>
              {estado === "FALTANTE" && <span className="text-orange-400 font-black">Faltante: ${faltante.toFixed(2)}</span>}
              {estado === "EXACTO" && <span className="text-green-400 font-black">Saldo: $0.00</span>}
              {estado === "VUELTO" && <span className="bg-[#00f5d4] text-black px-3 py-1 rounded-full font-black text-[11px] shadow-[0_0_15px_rgba(0,245,212,0.6)]">Vuelto: ${vuelto.toFixed(2)}</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 px-5">
          {["EFECTIVO","TARJETA","TRANSF","CREDITO"].map(t=><button key={t} onClick={()=>setTab(t)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider ${tab===t?"bg-[#00f5d4] text-black":"bg-[#1a2a44] text-white/60"}`}>{t}</button>)}
        </div>

        <div className="p-5 pt-3">
          {tab==="EFECTIVO" && (
            <div className="space-y-2">
              <div className="flex justify-between bg-[#1a2a44] p-3 rounded-xl items-center">
                <span className="text-[11px] font-bold text-white/50">Abono en efectivo</span>
                <input type="number" className="w-24 bg-black p-2 rounded text-right font-black text-cyan-400 border border-white/10" value={efectivoMonto || ""} onChange={e=>{
                  const v = Number(e.target.value)
                  setEfectivoMonto(v)
                  setConteo({}) 
                }} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {["100","50","20","10","5","1","0.25","0.10"].map(b=>(
                  <div key={b} className="bg-black p-2 rounded border border-white/5 flex flex-col items-center justify-between gap-1">
                    <span className="text-[10px] text-white/40">${b}</span>
                    {/* DENTRO DE TU MAP DE BILLETES, ASEGÚRATE QUE EL INPUT QUEDE ASÍ: */}
<input 
  type="number" 
  className="w-14 bg-[#1e293b] rounded text-center text-xs text-white" 
  value={conteo[b] || ""} // ➔ Si es 0 o no existe, se muestra limpio
  placeholder="0"
  onChange={e => {
    const v = parseInt(e.target.value) || 0
    const nuevoConteo = { ...conteo, [b]: v }
    setConteo(nuevoConteo)
    
    // Recalcula la suma total de billetes en el mismo instante
    const tot = Object.entries(nuevoConteo).reduce(
      (a: any, [bb, cc]: any) => a + parseFloat(bb) * Number(cc || 0), 0
    )
    setEfectivoMonto(tot)
  }} 
/>

                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==="TARJETA" && (
            <div className="space-y-3">
              <div className="bg-black p-3 rounded-xl space-y-2">
                <div className="flex justify-between items-center"><label className="text-[10px] opacity-50">Valor con Tarjeta</label>
                  <button onClick={()=>setTarjeta({...tarjeta, monto: Number(saldoPorCubrir.toFixed(2))})} className="bg-white/10 px-2 py-0.5 rounded text-[9px] text-cyan-400 font-bold hover:bg-white/20">Cargar Saldo ${saldoPorCubrir.toFixed(2)}</button>
                </div>
                <input type="number" className="w-full bg-[#1a2a44] p-3 rounded-xl font-black text-cyan-400 text-lg text-right" value={tarjeta.monto||""} onChange={e=>setTarjeta({...tarjeta, monto:Number(e.target.value)})} placeholder="0.00" />
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <select value={tarjeta.tipo} onChange={e=>setTarjeta({...tarjeta, tipo: e.target.value})} className="bg-[#1a2a44] border border-white/10 rounded-xl p-2.5 text-[11px] font-bold outline-none focus:border-[#00f5d4]">
                    <option value="CREDITO">Tarjeta de Crédito (SRI 19)</option><option value="DEBITO">Tarjeta de Débito (SRI 16)</option>
                  </select>
                  {tarjeta.tipo === "CREDITO" && (
                    <select value={tarjeta.plan} onChange={e=>setTarjeta({...tarjeta, plan: e.target.value})} className="bg-[#1a2a44] border border-white/10 rounded-xl p-2.5 text-[11px] font-bold outline-none focus:border-[#00f5d4]">
                      <option value="CORRIENTE">Crédito Corriente</option><option value="DIFERIDO">Diferido en Meses</option>
                    </select>
                  )}
                </div>

                {tarjeta.tipo === "CREDITO" && tarjeta.plan === "DIFERIDO" && (
                  <div className="mt-2 bg-[#1a2a44] p-2.5 rounded-xl border border-white/5 flex justify-between items-center"><span className="text-[10px] text-white/50 font-bold">Meses de Financiamiento:</span>
                    <select value={tarjeta.meses} onChange={e=>setTarjeta({...tarjeta, meses: Number(e.target.value)})} className="bg-black border border-white/10 rounded-lg p-1.5 text-xs font-mono outline-none text-[#00f5d4]">
                      <option value={3}>3 meses (Sin Intereses)</option><option value={6}>6 meses (Con Intereses)</option><option value={12}>12 meses</option><option value={24}>24 meses</option>
                    </select>
                  </div>
                )}
                <input type="text" placeholder="N° Voucher / Lote (Obligatorio)" className="w-full mt-2 bg-[#1a2a44] p-3 rounded-xl text-xs outline-none focus:border-[#00f5d4]" value={tarjeta.lote} onChange={e=>setTarjeta({...tarjeta, lote:e.target.value})} />
              </div>
            </div>
          )}

          {tab==="TRANSF" && (
            <div className="space-y-3">
              <div className="bg-black p-3 rounded-xl space-y-2">
                <div className="flex justify-between items-center"><label className="text-[10px] opacity-50">Valor Transferencia</label>
                  <button onClick={()=>setTransf({...transf, monto: Number(saldoPorCubrir.toFixed(2))})} className="bg-white/10 px-2 py-0.5 rounded text-[9px] text-cyan-400 font-bold hover:bg-white/20">Cargar Saldo ${saldoPorCubrir.toFixed(2)}</button>
                </div>
                <input type="number" className="w-full bg-[#1a2a44] p-3 rounded-xl font-black text-cyan-400 text-lg text-right" value={transf.monto||""} onChange={e=>setTransf({...transf, monto:Number(e.target.value)})} placeholder="0.00" />

              </div>
            </div>
          )}

          {tab==="CREDITO" && (
            <div className="bg-black p-3 rounded-xl">
              <input type="number" className="w-full bg-[#1a2a44] p-3 rounded-xl font-black text-cyan-400" value={credito||""} onChange={e=>setCredito(Number(e.target.value))} placeholder="Monto a crédito" />
            </div>
          )}

          <div className="p-5 pt-3 grid grid-cols-2 gap-3 mt-2">
            <button onClick={onClose} className="bg-white/10 p-4 rounded-xl font-bold">Cancelar</button>
            {estado === "FALTANTE" && (<button disabled className="bg-white/10 text-white/30 p-4 rounded-xl font-black text-[11px] cursor-not-allowed">Falta cubrir ${faltante.toFixed(2)}</button>)}
            {estado === "EXACTO" && (<button onClick={()=>{onConfirm({efectivo:{monto:baseEfectivo, cambio:0}, transf, tarjeta, credito}, [])}} className="bg-[#00f5d4] text-black p-4 rounded-xl font-black shadow-[0_0_20px_rgba(0,245,212,0.5)]">✓ CONFIRMAR PAGO Y EMITIR →</button>)}
            {estado === "VUELTO" && (
  <button onClick={() => {
    const entregado = baseEfectivo // lo que te puso en la mano: 40
    const vueltoFinal = vuelto // lo que devuelves: 5.50
    const enCaja = entregado - vueltoFinal // lo neto: 34.50
    onConfirm({
      efectivo: enCaja,          // 34.50 - NETO QUE SE QUEDA
      entregado: entregado,      // 40.00 - BRUTO QUE ENTRO
      cambio: vueltoFinal,       // 5.50 - VUELTO
      transf, 
      tarjeta, 
      credito
    }, [])
  }}>
    ✓ ENTREGAR VUELTO ${vuelto.toFixed(2)} Y CERRAR
  </button>
)}
          </div>
        </div>
      </div>
    </div>
  )
}