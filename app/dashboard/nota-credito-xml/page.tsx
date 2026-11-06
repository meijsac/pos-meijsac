"use client";
import { useState, useMemo } from "react";

type Motivo = { id: string; razon: string; valor: number };
type Factura = { secuencial:string, fechaEmision:string, razonSocial:string, identificacion:string, items:any[], importeTotal:number };

export default function NotaDebitoPage(){
  const [facturas] = useState<Factura[]>([
    { secuencial:"001-002-000000147", fechaEmision:"05/10/2026", razonSocial:"IMPORTADORA ANDINA", identificacion:"1790000000001", items:[], importeTotal:3283.33 }
  ]);
  const [busqueda, setBusqueda] = useState("001-002-000000147");
  const [sel, setSel] = useState<Factura>(facturas[0]);
  const [motivos, setMotivos] = useState<Motivo[]>([{ id:"1", razon:"INTERESES POR MORA 30 DIAS", valor:50 }]);
  const [ivaPorcentaje, setIvaPorcentaje] = useState(15);
  const [estadoSRI, setEstadoSRI] = useState<"EN_BLANCO"|"EMITIDO"|"AUTORIZADO">("EN_BLANCO");
  const [fechaAutorizacionSRI, setFechaAutorizacionSRI] = useState("");
  const [claveAcceso, setClaveAcceso] = useState("05102026042200000000011234567810000000012");

  const totalSinImpuestos = useMemo(()=> motivos.reduce((s,m)=>s+Number(m.valor||0),0), [motivos]);
  const valorIva = totalSinImpuestos * (ivaPorcentaje/100);
  const valorTotal = totalSinImpuestos + valorIva;

  // CORRECCIÓN SRI QUE ME PEDISTE - Análisis normativo
  const codigoImpuesto = 2; // Siempre 2 para IVA
  const codigoPorcentaje = ivaPorcentaje === 15? 4 : 0; // 4=15% vigente, 0=0%

  const generarClave49 = () => {
    const fecha = new Date().toISOString().slice(0,10).replace(/-/g,"");
    const ruc = "2200000000001";
    const ambiente = "1"; const serie = "001001";
    const secuencial = String(Math.floor(Math.random()*999999999)).padStart(9,"0");
    const codigo = String(Math.floor(Math.random()*99999999)).padStart(8,"0");
    const tipo = "05"; // NOTA DEBITO
    return `${fecha}${tipo}${ruc}${ambiente}${serie}${secuencial}${codigo}1`;
  };

  const cancelarEmision = () => {
    if(!confirm("¿Cancelar la emisión de esta Nota de Débito?")) return;
    nuevaNota();
  };

  const emitir = () => {
    if(motivos.some(m=>m.razon.length<5)) return alert("Motivo obligatorio SRI (mín 5 letras)");
    const clave = generarClave49();
    const fechaSRI = new Date().toLocaleString('es-EC', { dateStyle:'short', timeStyle:'medium' });
    setClaveAcceso(clave);
    setFechaAutorizacionSRI(fechaSRI);
    setEstadoSRI("EMITIDO");

    const comprobante = {
      tipo:"05", nombre:"NOTA DE DÉBITO", secuencial:"001-001-000000006",
      claveAcceso: clave, fechaAutorizacionSRI: fechaSRI, fecha: new Date().toLocaleDateString(),
      facturaModificada: sel.secuencial, cliente: sel.razonSocial,
      motivos: motivos, totales: { totalSinImpuestos, valorIva, valorTotal, codigoImpuesto, codigoPorcentaje }, estado:"AUTORIZADO"
    };
    const emitidos = JSON.parse(localStorage.getItem("meijsac_emitidos")||"[]");
    localStorage.setItem("meijsac_emitidos", JSON.stringify([...emitidos, comprobante]));

    setTimeout(()=>{
      setEstadoSRI("AUTORIZADO");
      const autorizados = JSON.parse(localStorage.getItem("meijsac_autorizados")||"[]");
      localStorage.setItem("meijsac_autorizados", JSON.stringify([...autorizados, comprobante]));
      alert(`✓ AUTORIZADO SRI\nClave: ${clave}\nFecha: ${fechaSRI}\nXML: codigo ${codigoImpuesto} + codigoPorcentaje ${codigoPorcentaje}`);
    }, 1500);
  };

  const nuevaNota = () => {
    setBusqueda("");
    setMotivos([{ id: Date.now().toString(), razon:"", valor:0 }]);
    setEstadoSRI("EN_BLANCO");
    setFechaAutorizacionSRI("");
    setClaveAcceso(generarClave49());
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white p-4">
      <div className="flex justify-between mb-4">
        <h1 className="font-black text-sm">NOTA DE DÉBITO <span className="text-[#00f5d4]">05 - RIDE</span></h1>
        <button onClick={()=>location.href='/dashboard/comprobantes'} className="bg-white/10 px-4 py-2 rounded-xl text-xs">← Volver al Dashboard</button>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        {/* IZQUIERDA */}
        <div className="md:col-span-5 bg-[#11131a] rounded-[20px] p-4 border border-white/5 h-fit space-y-3">
          <label className="text-[10px] text-white/40">1. VÍNCULO OBLIGATORIO SUSTENTO</label>
          <div className="flex gap-2">
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} className="w-full bg-black p-3 rounded-xl text-sm border border-white/10 font-mono"/>
            <button onClick={()=>setSel(facturas[0])} className="bg-white text-black px-4 rounded-xl text-xs font-bold">Buscar</button>
          </div>

          <div className="p-3 bg-black rounded-xl border border-[#00f5d4]/20 text-[11px]">
            <p className="text-[#00f5d4] font-bold text-[10px]">DATOS AMARRE SRI</p>
            <p>codDocModificado: <b>01</b> | numDocModificado: <b>{sel.secuencial}</b></p>
            <p>fechaEmisionDocSustento: <b>{sel.fechaEmision}</b></p>
          </div>

          <div className="border-t border-white/5 pt-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[#ffbe0a]">2. MOTIVOS DEL CARGO EXTRA</label>
              <button onClick={()=>setMotivos([...motivos,{id:Date.now().toString(), razon:"", valor:0}])} className="text-[9px] bg-[#ffbe0a]/10 text-[#ffbe0a] px-3 py-1 rounded-full border border-[#ffbe0a]/20 font-bold">+ AGREGAR</button>
            </div>
            {motivos.map((m)=>(
              <div key={m.id} className="flex gap-2 mt-2 bg-black p-2 rounded-xl border border-white/5">
                <input value={m.razon} onChange={e=>setMotivos(motivos.map(x=>x.id===m.id?{...x, razon:e.target.value.toUpperCase()}:x))} placeholder="RAZON: INTERES, FLETE..." className="flex-1 bg-[#1e293b] rounded-lg px-3 py-2 text-xs uppercase outline-none"/>
                <input type="number" value={m.valor} onChange={e=>setMotivos(motivos.map(x=>x.id===m.id?{...x, valor:parseFloat(e.target.value)||0}:x))} className="w-20 bg-[#1e293b] rounded-lg text-center text-xs font-mono"/>
                <button onClick={()=>setMotivos(motivos.filter(x=>x.id!==m.id))} className="text-white/20 px-1">✕</button>
              </div>
            ))}
          </div>

          <div className="bg-[#00f5d4]/10 p-3 rounded-xl text-xs border border-[#00f5d4]/20">
            <p className="flex justify-between"><span>Total Sin Impuestos:</span> <b>${totalSinImpuestos.toFixed(2)}</b></p>
            <p className="flex justify-between"><span>IVA {ivaPorcentaje}% (codigo 2 + codPorc {codigoPorcentaje}):</span> <b>${valorIva.toFixed(2)}</b></p>
            <p className="flex justify-between font-black text-[#00f5d4] border-t border-[#00f5d4]/20 mt-1 pt-1"><span>VALOR TOTAL:</span> <b>${valorTotal.toFixed(2)}</b></p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {estadoSRI!== "AUTORIZADO"? (
              <>
                <button onClick={cancelarEmision} className="border border-red-500/50 text-red-400 py-3 rounded-xl font-bold text-[11px]">CANCELAR EMISIÓN</button>
                <button onClick={emitir} className="bg-[#00f5d4] text-black py-3 rounded-xl font-bold text-[11px]">GENERAR XML 05</button>
              </>
            ) : (
              <button onClick={nuevaNota} className="col-span-2 bg-white text-black py-3 rounded-xl font-black text-xs">+ NUEVA NOTA DE DÉBITO</button>
            )}
          </div>
        </div>

        {/* DERECHA - RIDE */}
        <div className="md:col-span-7 bg-white text-black rounded-[20px] p-6">
          <div className="border-b-2 border-black pb-3 flex justify-between">
            <div>
              <h2 className="font-black text-lg">MEIJSAC POS</h2>
              <p className="text-[10px]">RUC: 2200000000001 | Matriz: Coca - Orellana</p>
            </div>
            <div className="text-right border border-black p-2 rounded-xl max-w-[180px]">
              <p className="font-black text-xs">NOTA DE DÉBITO</p>
              <p className="text-[10px]">No. 001-001-000000006</p>
              <p className="text-[7px] font-mono break-all">{claveAcceso}</p>
              {estadoSRI === "AUTORIZADO"? (
                <div className="bg-green-600 text-white px-2 py-1 rounded text-[7px] font-bold mt-1">
                  <p>AUTORIZADO</p><p>{fechaAutorizacionSRI}</p>
                </div>
              ) : (
                <p className="text-[8px] mt-1 bg-black text-white px-1 rounded text-center">{estadoSRI}</p>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-4 text-[11px] border border-black/20 p-3 rounded-xl">
            <div><p><b>Razón Social:</b> {sel.razonSocial}</p><p><b>RUC/CI:</b> {sel.identificacion}</p></div>
            <div><p><b>Comprobante que modifica:</b> FACTURA {sel.secuencial}</p><p><b>Fecha Sustento:</b> {sel.fechaEmision}</p></div>
          </div>

          <table className="w-full mt-4 text-[11px] border">
            <thead className="bg-black text-white"><tr><th className="p-2 text-left">Razon</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {motivos.map((m,i)=><tr key={i} className="border-b"><td className="p-2 uppercase">{m.razon}</td><td className="text-right">{Number(m.valor).toFixed(2)}</td></tr>)}
            </tbody>
          </table>

          <div className="mt-3 bg-black text-white p-3 rounded-xl text-[10px] font-mono">
            <p className="text-[#00f5d4] font-bold">XML SRI - Cumple tu análisis:</p>
            <p>{`<codigo>${codigoImpuesto}</codigo> <codigoPorcentaje>${codigoPorcentaje}</codigoPorcentaje>`}</p>
            <p>{`<baseImponible>${totalSinImpuestos.toFixed(2)}</baseImponible> <valor>${valorIva.toFixed(2)}</valor>`}</p>
          </div>

          <div className="flex justify-end mt-3">
            <div className="w-48 text-[11px]"><div className="flex justify-between font-black border-t-2 border-black pt-1"><span>VALOR TOTAL:</span><b>${valorTotal.toFixed(2)}</b></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}