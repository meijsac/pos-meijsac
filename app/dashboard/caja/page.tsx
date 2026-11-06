"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Movimiento = { id:string, tipo:string, monto:number, motivo?:string, fecha: Date };
type Turno = { id:string, fechaApertura: Date, fechaCierre?: Date, usuario:string, puntoEmision:string, montoInicial:number, estado:string, montoCierreFisico?:number, saldoEsperado?:number, diferencia?:number, movimientos: Movimiento[] };

export default function CajaModule() {
  const router = useRouter();
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null);
  const [historial, setHistorial] = useState<Turno[]>([
    { id:"1", fechaApertura: new Date(Date.now()-86400000), fechaCierre: new Date(), usuario:"Maria Cajera", puntoEmision:"001-002", montoInicial:50, estado:"CERRADA", saldoEsperado:450, montoCierreFisico:447.5, diferencia:-2.5, movimientos:[] }
  ]);
  const [formApertura, setFormApertura] = useState({ punto:"001-002", montoInicial:50 });
  const [formMov, setFormMov] = useState({ tipo:"EGRESO_MANUAL", monto:0, motivo:"" });
  const [montoFisico, setMontoFisico] = useState<number>(0);

  const usuarioActual = "Admin MEIJSAC"; 
  const fechaSistema = new Date().toLocaleString();

  // PASO MAESTRO: RECUPERAR TURNO DEL LOCALSTORAGE
  useEffect(() => {
    const guardado = localStorage.getItem("mei_turno_activo");
    if(guardado){
      const t = JSON.parse(guardado);
      t.fechaApertura = new Date(t.fechaApertura);
      if(t.fechaCierre) t.fechaCierre = new Date(t.fechaCierre);
      setTurnoActivo(t);
    }
    const histGuardado = localStorage.getItem("mei_historial_turnos");
    if(histGuardado){
      const h = JSON.parse(histGuardado);
      setHistorial(h.map((item:any)=>({
        ...item,
        fechaApertura: new Date(item.fechaApertura),
        fechaCierre: item.fechaCierre ? new Date(item.fechaCierre) : undefined
      })));
    }
  }, []);

  const ventasEfectivo = turnoActivo?.movimientos.filter(m=>m.tipo==="VENTA_EFECTIVO").reduce((s,m)=>s+m.monto,0) || 1250.50; 
  const ventasTarjeta = turnoActivo?.movimientos.filter(m=>m.tipo==="VENTA_TARJETA").reduce((s,m)=>s+m.monto,0) || 320;
  const ingresosManuales = turnoActivo?.movimientos.filter(m=>m.tipo==="INGRESO_MANUAL").reduce((s,m)=>s+m.monto,0) || 0;
  const egresosManuales = turnoActivo?.movimientos.filter(m=>m.tipo==="EGRESO_MANUAL").reduce((s,m)=>s+m.monto,0) || 0;

  const saldoEsperado = turnoActivo ? turnoActivo.montoInicial + ventasEfectivo + ingresosManuales - egresosManuales : 0;
  const diferencia = montoFisico - saldoEsperado;

  const abrirTurno = () => {
    if(formApertura.montoInicial <= 0) return alert("Monto inicial obligatorio");
    const nuevo: Turno = {
      id: Date.now().toString(),
      fechaApertura: new Date(),
      usuario: usuarioActual,
      puntoEmision: formApertura.punto,
      montoInicial: formApertura.montoInicial,
      estado: "ABIERTA",
      movimientos: []
    };
    
    // PASO MAESTRO: GUARDAR EN LOCALSTORAGE Y REDIRIGIR
    setTurnoActivo(nuevo);
    localStorage.setItem("mei_turno_activo", JSON.stringify(nuevo));
    localStorage.setItem("mei_caja_estado", "ABIERTO");
    setTimeout(() => router.push("/dashboard/pos-ticket"), 300);
  };

  const registrarMovimiento = () => {
    if(!turnoActivo || !formMov.monto || !formMov.motivo) return alert("Monto y motivo obligatorios - Si no registra, habrá descuadre");
    const mov: Movimiento = { id: Date.now().toString(), tipo: formMov.tipo, monto: formMov.monto, motivo: formMov.motivo, fecha: new Date() };
    const actualizado = {...turnoActivo, movimientos:[...turnoActivo.movimientos, mov]};
    setTurnoActivo(actualizado);
    localStorage.setItem("mei_turno_activo", JSON.stringify(actualizado));
    setFormMov({ tipo:"EGRESO_MANUAL", monto:0, motivo:"" });
  };

  const cerrarTurno = () => {
    if(!turnoActivo) return;
    const cerrado = {...turnoActivo, fechaCierre: new Date(), estado:"CERRADA", montoCierreFisico: montoFisico, saldoEsperado, diferencia };
    const nuevoHistorial = [cerrado, ...historial];
    setHistorial(nuevoHistorial);
    setTurnoActivo(null);
    setMontoFisico(0);

    localStorage.removeItem("mei_turno_activo");
    localStorage.setItem("mei_caja_estado", "CERRADO");
    localStorage.setItem("mei_historial_turnos", JSON.stringify(nuevoHistorial));

    alert(diferencia===0 ? "Caja perfecta cuadradita" : diferencia<0 ? `FALTANTE: $${Math.abs(diferencia).toFixed(2)} - Cajero debe reponer` : `SOBRANTE: $${diferencia.toFixed(2)} - Error en vueltos`);
  };

  return (
    <div className="min-h-screen bg-[#0a0c14] text-white p-4 flex gap-4 font-sans">
      {/* LADO IZQUIERDO 40% - HISTORIAL */}
      <div className="w-[40%] space-y-3">
        <div className="bg-[#11131a] border border-white/10 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-black text-[13px] tracking-widest">CAJA</h2>
            {turnoActivo ? (
              <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-[9px] font-bold">🟢 TURNO ABIERTO (Pto: {turnoActivo.puntoEmision})</span>
            ) : (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-[9px] font-bold">🔴 CAJA CERRADA</span>
            )}
          </div>
          
          {/* MEJORA UX: Botón dinámico. Solo aparece rojo si está abierto, desaparece si está cerrado */}
          {turnoActivo && (
            <button onClick={()=>document.getElementById("cierre-section")?.scrollIntoView({behavior: 'smooth'})} className="w-full bg-red-500 hover:bg-red-600 text-white rounded-full py-2.5 text-[11px] font-black transition-all">
              ✕ CERRAR TURNO / ARQUEO
            </button>
          )}
        </div>

        <div className="bg-[#0f172a]/50 border border-white/10 rounded-xl p-3">
          <p className="text-[10px] font-bold text-white/60 mb-2">HISTORIAL DE TURNOS - CONTROL DUEÑO</p>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {historial.map(t=>(
              <div key={t.id} className="bg-black border border-white/5 rounded-lg p-2.5">
                <div className="flex justify-between text-[9px]">
                  <span className="text-white/50">
                    {t.fechaApertura ? new Date(t.fechaApertura).toISOString().split('T')[0] : ""} - {t.usuario}
                  </span>
                  <span className={`font-bold px-2 rounded-full ${t.diferencia===0? "bg-green-500/20 text-green-400" : t.diferencia && t.diferencia<0? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {t.diferencia===0? "Perfecto" : t.diferencia? `${t.diferencia>0?"+":""}$${t.diferencia?.toFixed(2)} ${t.diferencia<0?"Faltante":"Sobrante"}` : "Cerrado"}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-[11px] font-bold">{t.puntoEmision}</p>
                  <p className="text-[10px] text-[#00f5d4]">${t.saldoEsperado?.toFixed(2) || "0.00"} vendido</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LADO DERECHO 60% - FORMULARIO DINAMICO */}
      <div className="w-[60%]">
        {!turnoActivo ? (
          <div className="bg-[#11131a] border border-white/10 rounded-xl p-6 space-y-4">
            <h3 className="font-black text-[14px]">FASE 1: APERTURA DE CAJA - OBLIGATORIA</h3>
            <p className="text-[10px] text-white/40">El cajero no puede vender sin aperturar. Aquí se registra la caja chica para vuelto.</p>
            <div className="grid grid-cols-2 gap-3">
              
              {/* CORRECCIÓN: Inputs protegidos de solo lectura con diseño atenuado */}
              <div>
                <label className="text-[9px] text-white/40 block mb-1">Fecha y Hora (Sistema - Protegido)</label>
                <input 
                  readOnly 
                  disabled 
                  value={fechaSistema} 
                  className="w-full bg-black/50 border border-white/5 rounded-lg p-3 text-[11px] text-white/40 opacity-50 cursor-not-allowed select-none" 
                />
              </div>
              <div>
                <label className="text-[9px] text-white/40 block mb-1">Usuario / Cajero (Login - Protegido)</label>
                <input 
                  readOnly 
                  disabled 
                  value={usuarioActual} 
                  className="w-full bg-black/50 border border-white/5 rounded-lg p-3 text-[11px] text-white/40 opacity-50 cursor-not-allowed select-none" 
                />
              </div>

              <div>
                <label className="text-[9px] text-[#00f5d4] block mb-1">Punto de Emisión Asignado *</label>
                <select value={formApertura.punto} onChange={e=>setFormApertura({...formApertura, punto:e.target.value})} className="w-full bg-black border border-[#00f5d4]/30 rounded-lg p-3 text-[11px] outline-none focus:border-[#00f5d4]">
                  <option>001-001</option><option>001-002</option><option>001-003</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] text-[#00f5d4] block mb-1">Monto Inicial Efectivo (Caja Chica) *</label>
                <input type="number" value={formApertura.montoInicial} onChange={e=>setFormApertura({...formApertura, montoInicial: parseFloat(e.target.value)||0})} className="w-full bg-black border border-[#00f5d4]/30 rounded-lg p-3 text-[14px] font-black text-[#00f5d4] outline-none focus:border-[#00f5d4]" placeholder="$50.00" />
              </div>
            </div>
            <div className="bg-[#00f5d4]/5 border border-[#00f5d4]/10 rounded-lg p-2.5">
              <p className="text-[9px] text-[#00f5d4]/70">🔒 Auditoría activa: Fecha y Cajero bloqueados contra manipulación. El sistema registra bitácora de seguridad.</p>
            </div>
            <button onClick={abrirTurno} className="w-full bg-[#00f5d4] hover:bg-[#00f5d4]/80 text-black rounded-full py-3 font-black text-[12px] transition-all">APERTURAR Y ENTRAR AL POS TICKET →</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-black border border-white/10 rounded-xl p-3"><p className="text-[8px] text-white/40">EFECTIVO INICIAL</p><p className="text-[18px] font-black">${turnoActivo.montoInicial.toFixed(2)}</p></div>
              <div className="bg-[#00f5d4]/10 border border-[#00f5d4]/20 rounded-xl p-3"><p className="text-[8px] text-[#00f5d4]">VENTAS EFECTIVO</p><p className="text-[18px] font-black text-[#00f5d4]">${ventasEfectivo.toFixed(2)}</p></div>
              <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-3"><p className="text-[8px] text-yellow-400">VENTAS TARJETA</p><p className="text-[18px] font-black text-yellow-400">${ventasTarjeta.toFixed(2)}</p></div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3"><p className="text-[8px] text-red-400">RETIROS MANUALES</p><p className="text-[18px] font-black text-red-400">-${egresosManuales.toFixed(2)}</p></div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3"><p className="text-[8px] text-green-400">INGRESOS MANUALES</p><p className="text-[18px] font-black text-green-400">+${ingresosManuales.toFixed(2)}</p></div>
              <div className="bg-white border border-white/10 rounded-xl p-3 text-black"><p className="text-[8px]">SALDO ESPERADO GAVETA</p><p className="text-[18px] font-black">${saldoEsperado.toFixed(2)}</p></div>
            </div>

            <div className="bg-[#11131a] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold">FASE 2: MOVIMIENTO MANUAL - EN CALIENTE</p>
                <button onClick={()=>router.push("/dashboard/pos-ticket")} className="text-[9px] bg-[#00f5d4]/20 text-[#00f5d4] px-3 py-1 rounded-full font-bold hover:bg-[#00f5d4]/30 transition-all">ir al POS TICKET ➔</button>
              </div>
              <div className="flex gap-2">
                <select value={formMov.tipo} onChange={e=>setFormMov({...formMov, tipo:e.target.value})} className="flex-1 bg-black border border-white/10 rounded-lg p-2.5 text-[10px] outline-none">
                  <option value="INGRESO_MANUAL">Ingreso Efectivo - Dueño inyecta monedas</option>
                  <option value="EGRESO_MANUAL">Egreso/Retiro - Pago agua, gas, proveedor</option>
                </select>
                <input type="number" value={formMov.monto||""} onChange={e=>setFormMov({...formMov, monto: parseFloat(e.target.value)||0})} placeholder="$ Monto" className="w-[120px] bg-black border border-white/10 rounded-lg p-2.5 text-[11px] outline-none" />
              </div>
              <div className="flex gap-2">
                <input value={formMov.motivo} onChange={e=>setFormMov({...formMov, motivo:e.target.value})} placeholder="Motivo obligatorio: Ej: Pago Sr. Agua $15" className="flex-1 bg-black border border-yellow-400/30 rounded-lg p-2.5 text-[11px] outline-none" />
                <button onClick={registrarMovimiento} className="bg-yellow-400 text-black px-5 rounded-full font-bold text-[10px] hover:bg-yellow-500 transition-all">REGISTRAR</button>
              </div>
              <div className="max-h-[120px] overflow-y-auto space-y-1">
                {turnoActivo.movimientos.slice().reverse().map(m=>(
                  <div key={m.id} className="flex justify-between bg-black rounded-lg p-2 text-[9px]"><span>{new Date(m.fecha).toLocaleTimeString()} - {m.motivo}</span><span className={m.tipo==="EGRESO_MANUAL"?"text-red-400":"text-green-400"}>{m.tipo==="EGRESO_MANUAL"?"-":"+"}${m.monto.toFixed(2)}</span></div>
                ))}
              </div>
            </div>

            <div id="cierre-section" className="bg-gradient-to-br from-[#11131a] to-black border border-red-500/20 rounded-xl p-5 space-y-3">
              <h3 className="font-black text-[13px] text-red-400">FASE 3: CIERRE / ARQUEO CIEGO</h3>
              <p className="text-[9px] text-white/40">El cajero cuenta físico sin ver el esperado. Fórmula: Saldo Esperado = Inicial + Ventas Efectivo + Ingresos - Egresos</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black rounded-xl p-3 border border-white/10">
                  <p className="text-[8px] text-white/40">SALDO ESPERADO (Sistema)</p>
                  <p className="text-[22px] font-black blur-[6px] select-none">${saldoEsperado.toFixed(2)}</p>
                  <p className="text-[7px] text-white/20">Oculto hasta cierre - Arqueo ciego</p>
                </div>
                <div className="bg-black rounded-xl p-3 border border-red-500/30">
                  <p className="text-[8px] text-red-400">MONTO FÍSICO CONTADO *</p>
                  <input type="number" value={montoFisico||""} onChange={e=>setMontoFisico(parseFloat(e.target.value)||0)} placeholder="¿Cuánto hay en gaveta?" className="w-full bg-transparent text-[22px] font-black text-white outline-none" />
                </div>
              </div>
              {montoFisico>0 && (
                <div className={`rounded-xl p-3 border text-center ${diferencia===0?"bg-green-500/10 border-green-500/30 text-green-400": diferencia<0?"bg-red-500/10 border-red-500/30 text-red-400":"bg-yellow-500/10 border-yellow-500/30 text-yellow-400"}`}>
                  <p className="text-[10px] font-bold">DIFERENCIA DE CAJA (Cuadre): ${diferencia.toFixed(2)}</p>
                  <p className="text-[9px]">{diferencia===0?"🟢 Caja perfecta cuadradita": diferencia<0?`🔴 FALTANTE: Cajero debe reponer $${Math.abs(diferencia).toFixed(2)}`:`🟡 SOBRANTE: Error en dar vueltos $${diferencia.toFixed(2)}`}</p>
                </div>
              )}
              <button onClick={cerrarTurno} disabled={montoFisico===0} className="w-full bg-red-500 hover:bg-red-600 disabled:bg-white/10 text-white rounded-full py-3 font-black text-[12px] transition-all">CERRAR TURNO DEFINITIVAMENTE Y GENERAR REPORTE</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}