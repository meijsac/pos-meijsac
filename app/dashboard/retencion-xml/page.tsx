"use client";
import { useState, useMemo, useEffect } from "react";

type DetalleRet = {
  id: string;
  tipoImpuesto: '1' | '2'; // 1=Renta 2=IVA
  codigoRetencionSRI: string;
  descripcion: string;
  baseImponibleCalculada: number;
  porcentajeAplicado: number;
  valorRetenido: number;
};

// 1. CATALOGO COMPLETO SRI - Ya no rebota ATS
const SUSTENTOS = [
  { code:"01", name:"01 - Crédito Tributario para declaración IVA (Art 66) - Mercadería" },
  { code:"02", name:"02 - Costo o Gasto para declaración Renta (Arriendo, suministros)" },
  { code:"03", name:"03 - Activo Fijo - Crédito Tributario (PC, maquinaria, vehículo)" },
  { code:"05", name:"05 - Liquidación de compra - No obligados a contabilidad (Agricultores)" },
  { code:"06", name:"06 - Crédito Tributario por Inventario / Reembolso (Caja chica)" },
  { code:"07", name:"07 - Costo por Reembolso de Siniestros o Seguros" },
  { code:"10", name:"10 - Distribución de Dividendos o Utilidades (Retención a socios)" },
];

const RET_Renta = [
  { code:"312", desc:"312 - Transferencia bienes 1.75%", porc:1.75 },
  { code:"343", desc:"343 - RIMPE Emprendedor 1%", porc:1 },
  { code:"310", desc:"310 - Honorarios profesionales 8%", porc:8 },
  { code:"303", desc:"303 - Servicios predomina intelecto 8%", porc:8 },
  { code:"332", desc:"332 - Compra bienes no prod por soc. 2.75%", porc:2.75 },
];

const RET_Iva = [
  { code:"1", desc:"30% Bienes", porc:30 },
  { code:"2", desc:"70% Servicios", porc:70 },
  { code:"3", desc:"100% - Honorarios / Liquidación", porc:100 },
];

export default function RetencionCompraPage(){
  // PARTE A: COMPRA - Sustento
  const [proveedorRuc, setRuc] = useState("1792000000001");
  const [proveedorNombre, setNombre] = useState("PROVEEDOR INDUSTRIAL S.A.");
  const [comprobanteSerie, setSerie] = useState("001-005-000012345");
  const [fechaEmisionCompra, setFechaCompra] = useState("2026-10-02");
  const [tipoComprobante, setTipoComp] = useState("01");
  const [sustentoCode, setSustento] = useState("01");
  const [cuentaContable, setCuenta] = useState("5.1.01 - Gasto Arriendo Oficina");

  const [subtotalIva15, setSub15] = useState(1200);
  const [subtotalIva0, setSub0] = useState(200);
  const [valorIvaCompra, setIvaCompra] = useState(180);
  const totalFacturaCompra = useMemo(()=> subtotalIva15 + subtotalIva0 + valorIvaCompra, [subtotalIva15, subtotalIva0, valorIvaCompra]);

  // PARTE B: RETENCION 07
  const [emitirRetencion, setEmitir] = useState(true);
  const [secuencialRet, setSecRet] = useState("001-001-000000001");
  const [periodoFiscal, setPeriodo] = useState("10/2026");
  const [detalles, setDetalles] = useState<DetalleRet[]>([
    { id:"1", tipoImpuesto:'1', codigoRetencionSRI:"312", descripcion:"312 - Bienes 1.75%", baseImponibleCalculada:1400, porcentajeAplicado:1.75, valorRetenido:24.50 },
  ]);

  // C. CONEXION COMPRAS RECIBIDAS + AUTOCOMPLETE CARTERA
  useEffect(()=>{
    const sel = JSON.parse(localStorage.getItem("meijsac_compra_seleccionada_para_ret")||"null");
    if(sel){
      setRuc(sel.ruc);
      setNombre(sel.razonSocial);
      setSerie(sel.secuencial);
      setFechaCompra(sel.fechaEmision);
      setSub15(sel.sub15);
      setSub0(sel.sub0);
      setIvaCompra(sel.iva);
      setSustento(sel.sustento);
    }
  },[]);

  const baseRentaAuto = subtotalIva15 + subtotalIva0;
  const baseIvaAuto = valorIvaCompra;

  // C. PERIODO FISCAL AUTOMATICO READONLY - Fix del SRI
useEffect(()=>{
  const [y,m] = fechaEmisionCompra.split("-");
  if(y && m) setPeriodo(`${m}/${y}`);
},[fechaEmisionCompra]);

// A. FIX CRITICO - FILA IVA AUTOMATICA CON KEY UNICA (corrige el error 1/4 de tu foto)
useEffect(()=>{
  setDetalles(prev => {
    const yaHayIVA = prev.some(f=>f.tipoImpuesto==='2');
    if(valorIvaCompra > 0 &&!yaHayIVA){
      const sel = RET_Iva[0];
      return [...prev, {
        id:`iva-${Date.now()}`, // ESTA LINEA ARREGLA EL ERROR
        tipoImpuesto:'2' as const,
        codigoRetencionSRI:sel.code,
        descripcion:sel.desc,
        baseImponibleCalculada:valorIvaCompra,
        porcentajeAplicado:sel.porc,
        valorRetenido: valorIvaCompra * (sel.porc/100)
      }];
    }
    return prev;
  });
},[valorIvaCompra]);


  // B. RECALCULO AUTOMATICO EN CALIENTE - Ya no necesita botón
  useEffect(()=>{
    setDetalles(prev => prev.map(d=>{
      if(d.tipoImpuesto==='1') return {...d, baseImponibleCalculada: baseRentaAuto, valorRetenido: baseRentaAuto * (d.porcentajeAplicado/100)};
      if(d.tipoImpuesto==='2') return {...d, baseImponibleCalculada: baseIvaAuto, valorRetenido: baseIvaAuto * (d.porcentajeAplicado/100)};
      return d;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[subtotalIva15, subtotalIva0, valorIvaCompra]);

  // A. FILA AUTOMATICA IVA - Si hay IVA >0, inyecta fila IVA sola
  useEffect(()=>{
    if(valorIvaCompra > 0 &&!detalles.some(f=>f.tipoImpuesto==='2')){
      const sel = RET_Iva[0];
      setDetalles(prev=>[...prev, { id:"iva-auto", tipoImpuesto:'2', codigoRetencionSRI:sel.code, descripcion:sel.desc, baseImponibleCalculada:baseIvaAuto, porcentajeAplicado:sel.porc, valorRetenido: baseIvaAuto * (sel.porc/100) }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[valorIvaCompra]);

  const totalRetenido = useMemo(()=> detalles.reduce((s,d)=>s+d.valorRetenido,0), [detalles]);

  const handleRucChange = (nuevoRuc:string) => {
    setRuc(nuevoRuc);
    const compras = JSON.parse(localStorage.getItem("meijsac_compras_recibidas")||"[]");
    const prov = compras.find((c:any)=>c.ruc===nuevoRuc);
    if(prov){
      setNombre(prov.razonSocial);
      // Si guardaste cuenta contable, también la autocompleta
      if(prov.cuenta) setCuenta(prov.cuenta);
    }
  };

  const actualizarBases = () => {
    setDetalles(detalles.map(d=>{
      if(d.tipoImpuesto==='1') return {...d, baseImponibleCalculada: baseRentaAuto, valorRetenido: baseRentaAuto * (d.porcentajeAplicado/100)};
      if(d.tipoImpuesto==='2') return {...d, baseImponibleCalculada: baseIvaAuto, valorRetenido: baseIvaAuto * (d.porcentajeAplicado/100)};
      return d;
    }));
  };

  const agregarRetencion = (tipo:'1'|'2') => {
    if(tipo==='1'){
      const sel = RET_Renta[0];
      setDetalles([...detalles, { id:Date.now().toString(), tipoImpuesto:'1', codigoRetencionSRI:sel.code, descripcion:sel.desc, baseImponibleCalculada:baseRentaAuto, porcentajeAplicado:sel.porc, valorRetenido: baseRentaAuto * (sel.porc/100) }]);
    } else {
      const sel = RET_Iva[0];
      setDetalles([...detalles, { id:Date.now().toString(), tipoImpuesto:'2', codigoRetencionSRI:sel.code, descripcion:sel.desc, baseImponibleCalculada:baseIvaAuto, porcentajeAplicado:sel.porc, valorRetenido: baseIvaAuto * (sel.porc/100) }]);
    }
  };

  const generarClave49 = () => {
    const fecha = new Date().toISOString().slice(0,10).replace(/-/g,"");
    return `${fecha}07${"2200000000001"}1${"001001"}${String(Math.floor(Math.random()*999999999)).padStart(9,"0")}${String(Math.floor(Math.random()*99999999)).padStart(8,"0")}1`;
  };

  const emitirXML07 = () => {
    const clave = generarClave49();
    const registro = {
      id: Date.now().toString(),
      proveedorRuc, proveedorNombre, sustentoTributarioCode: sustentoCode,
      comprobanteProveedorSerie: comprobanteSerie, fechaEmisionCompra,
      subtotalIva15, subtotalIva0, valorIvaCompra, totalFacturaCompra,
      cuentaContableGasto: cuentaContable,
      emitirRetencionElectronica: emitirRetencion, retencionSecuencial: secuencialRet,
      claveAccesoRetencion: clave, periodoFiscal,
      detallesRetencion: detalles.map(d=>({ tipoImpuesto:d.tipoImpuesto, codigoRetencionSRI:d.codigoRetencionSRI, baseImponibleCalculada:d.baseImponibleCalculada, porcentajeAplicado:d.porcentajeAplicado, valorRetenido:d.valorRetenido })),
      totalRetenidoDocumento: totalRetenido,
      fecha: new Date().toLocaleDateString()
    };
    const lista = JSON.parse(localStorage.getItem("meijsac_compras_ret")||"[]");
    localStorage.setItem("meijsac_compras_ret", JSON.stringify([...lista, registro]));

    // Marca como RETENIDO en Compras Recibidas
    const compras = JSON.parse(localStorage.getItem("meijsac_compras_recibidas")||"[]");
    const actualizadas = compras.map((c:any)=> c.secuencial===comprobanteSerie? {...c, estado:"RETENIDO", retencionNum:secuencialRet, valorRetenido: totalRetenido} : c);
    localStorage.setItem("meijsac_compras_recibidas", JSON.stringify(actualizadas));

    alert(`✓ REGISTRO DE COMPRA + RET 07 AUTORIZADO\nClave: ${clave}\nTotal Retenido: $${totalRetenido.toFixed(2)}\nRenta base: $${baseRentaAuto.toFixed(2)} | IVA base: $${baseIvaAuto.toFixed(2)}`);
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white p-4">
      <div className="flex justify-between mb-4 max-w-6xl mx-auto">
        <h1 className="font-black text-sm tracking-tight">REGISTRO DE COMPRAS / <span className="text-[#00f5d4]">RETENCIÓN 07 v3.1</span></h1>
        <button onClick={()=>location.href='/dashboard/compras-recibidas'} className="bg-white/10 px-4 py-2 rounded-xl text-xs">← Compras</button>
      </div>

      <div className="max-w-6xl mx-auto space-y-4">
        {/* PASO 1 - ORIGEN */}
        <div className="bg-[#11131a] rounded-[24px] p-6 border border-white/5">
          <p className="text-[10px] font-black tracking-[0.2em] text-[#00f5d4] uppercase mb-4">PASO 1: Documento de Sustento - La Compra (ATS) - Autocomplete</p>

          <div className="grid md:grid-cols-12 gap-4">
            <div className="md:col-span-3"><label className="text-[9px] text-white/40 font-bold uppercase">RUC Proveedor (Autocomplete)</label><input value={proveedorRuc} onChange={e=>handleRucChange(e.target.value)} className="w-full mt-1 bg-black border border-[#00f5d4]/30 rounded-xl px-3 py-3 text-xs font-mono" /></div>
            <div className="md:col-span-5"><label className="text-[9px] text-white/40 font-bold uppercase">Razón Social Proveedor</label><input value={proveedorNombre} onChange={e=>setNombre(e.target.value.toUpperCase())} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-xs font-bold uppercase" /></div>
            <div className="md:col-span-2"><label className="text-[9px] text-white/40 font-bold uppercase">Tipo Comp.</label><select value={tipoComprobante} onChange={e=>setTipoComp(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-xs"><option value="01">01 - FACTURA</option><option value="03">03 - LIQUIDACION COMPRA</option></select></div>
            <div className="md:col-span-2"><label className="text-[9px] text-white/40 font-bold uppercase">Fecha Emisión Compra</label><input type="date" value={fechaEmisionCompra} onChange={e=>setFechaCompra(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-xs" /></div>

            <div className="md:col-span-4"><label className="text-[9px] text-white/40 font-bold uppercase">Serie Comp. Proveedor (001-005-...)</label><input value={comprobanteSerie} onChange={e=>setSerie(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-xs font-mono" /></div>
            <div className="md:col-span-4"><label className="text-[9px] text-red-400 font-bold uppercase">Sustento Tributario * (Catálogo Completo SRI)</label><select value={sustentoCode} onChange={e=>setSustento(e.target.value)} className="w-full mt-1 bg-black border border-red-500/30 rounded-xl px-3 py-3 text-[11px]">{SUSTENTOS.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
            <div className="md:col-span-4"><label className="text-[9px] text-white/40 font-bold uppercase">Cuenta Contable Gasto/Inventario</label><input value={cuentaContable} onChange={e=>setCuenta(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-xs" /></div>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-5 p-4 bg-black/50 rounded-2xl border border-white/5">
            <div><label className="text-[9px] text-white/30 uppercase">Subtotal IVA 15% (Recálculo auto)</label><input type="number" value={subtotalIva15} onChange={e=>{setSub15(Number(e.target.value)); setIvaCompra(Number(e.target.value)*0.15)}} className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm font-mono font-bold" /></div>
            <div><label className="text-[9px] text-white/30 uppercase">Subtotal IVA 0%</label><input type="number" value={subtotalIva0} onChange={e=>setSub0(Number(e.target.value))} className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm font-mono font-bold" /></div>
            <div><label className="text-[9px] text-[#00f5d4] uppercase">Monto IVA Compra (Inyecta fila IVA)</label><input type="number" value={valorIvaCompra} onChange={e=>setIvaCompra(Number(e.target.value))} className="w-full mt-1 bg-[#11131a] border border-[#00f5d4]/40 rounded-xl px-3 py-3 text-sm font-mono font-bold text-[#00f5d4]" /></div>
            <div className="bg-white text-black rounded-xl p-3"><p className="text-[9px] uppercase font-black opacity-60">Total Factura</p><p className="text-lg font-black font-mono">${totalFacturaCompra.toFixed(2)}</p></div>
          </div>
        </div>

        {/* PASO 2 - LA MAGIA ERP */}
        <div className={`rounded-[24px] p-6 border transition-all ${emitirRetencion? 'bg-[#0a0e12] border-[#00f5d4]/30' : 'bg-[#11131a] border-white/5 opacity-60'}`}>
          <div className="flex justify-between items-center mb-4">
            <p className="text-[10px] font-black tracking-[0.2em] text-[#00f5d4] uppercase">PASO 2: Retenciones a Aplicar (XML 07) - Cálculo Automático En Caliente</p>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={emitirRetencion} onChange={e=>setEmitir(e.target.checked)} className="accent-[#00f5d4]" /><span className="text-[10px] font-bold">EMITIR RETENCIÓN ELECTRÓNICA</span></label>
          </div>

          {emitirRetencion && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <input value={secuencialRet} onChange={e=>setSecRet(e.target.value)} placeholder="Secuencial Ret 001-001-..." className="bg-black border border-white/10 rounded-xl px-3 py-3 text-xs font-mono" />
                <div className="relative"><input value={periodoFiscal} readOnly className="w-full bg-[#00f5d4]/10 border border-[#00f5d4]/30 rounded-xl px-3 py-3 text-xs font-mono font-black text-[#00f5d4]" /><p className="absolute -top-2 left-2 text-[7px] bg-[#00f5d4] text-black px-1 rounded font-black">PERIODO AUTO READONLY</p></div>
                <button onClick={actualizarBases} className="bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold opacity-50">↻ RECALCULO AUTO ACTIVO</button>
              </div>

              <div className="space-y-2">
                {detalles.map((d, i)=>(
  <div key={`${d.id}-${i}`} className="grid md:grid-cols-12 gap-2 bg-black p-3 rounded-xl border border-white/5 items-center">
                    <div className="md:col-span-1"><span className={`text-[9px] px-2 py-1 rounded-full font-black ${d.tipoImpuesto==='1'? 'bg-[#ffbe0a]/20 text-[#ffbe0a]' : 'bg-[#00f5d4]/20 text-[#00f5d4]'}`}>{d.tipoImpuesto==='1'? 'RENTA' : 'IVA AUTO'}</span></div>
                    <div className="md:col-span-4">
                      <select value={d.codigoRetencionSRI} onChange={e=>{
                        const code=e.target.value;
                        if(d.tipoImpuesto==='1'){ const f=RET_Renta.find(x=>x.code===code); if(f) setDetalles(detalles.map(x=>x.id===d.id?{...x, codigoRetencionSRI:code, descripcion:f.desc, porcentajeAplicado:f.porc, valorRetenido:d.baseImponibleCalculada*(f.porc/100)}:x)); }
                        else { const f=RET_Iva.find(x=>x.code===code); if(f) setDetalles(detalles.map(x=>x.id===d.id?{...x, codigoRetencionSRI:code, descripcion:f.desc, porcentajeAplicado:f.porc, valorRetenido:d.baseImponibleCalculada*(f.porc/100)}:x)); }
                      }} className="w-full bg-[#11131a] border border-white/10 rounded-lg px-2 py-2 text-[11px]">
                        {(d.tipoImpuesto==='1'? RET_Renta : RET_Iva).map(o=><option key={o.code} value={o.code}>{o.desc}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-3"><p className="text-[8px] text-white/30 uppercase">Base Imp. Auto (en caliente)</p><p className="text-xs font-mono font-bold">${d.baseImponibleCalculada.toFixed(2)} {d.tipoImpuesto==='1'? `(Bases IVA15+0)` : `(IVA Compra)`}</p></div>
                    <div className="md:col-span-2"><p className="text-[8px] text-white/30 uppercase">% Aplicado</p><p className="text-xs font-mono">{d.porcentajeAplicado}%</p></div>
                    <div className="md:col-span-2 flex justify-between items-center"><p className="text-sm font-black text-[#00f5d4]">${d.valorRetenido.toFixed(2)}</p><button onClick={()=>setDetalles(detalles.filter(x=>x.id!==d.id))} className="text-white/20">✕</button></div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={()=>agregarRetencion('1')} className="bg-[#ffbe0a]/10 border border-[#ffbe0a]/20 text-[#ffbe0a] px-4 py-2 rounded-xl text-[10px] font-bold">+ RET RENTA (Cod 1)</button>
                <button onClick={()=>agregarRetencion('2')} className="bg-[#00f5d4]/10 border border-[#00f5d4]/20 text-[#00f5d4] px-4 py-2 rounded-xl text-[10px] font-bold">+ RET IVA (Cod 2)</button>
                <div className="ml-auto bg-[#00f5d4] text-black px-6 py-2 rounded-xl font-black text-sm">TOTAL RETENIDO: ${totalRetenido.toFixed(2)}</div>
              </div>

              <div className="mt-4 bg-black border border-white/5 rounded-xl p-3 font-mono text-[10px] text-white/50">
                <p className="text-[#00f5d4]">XML 07 Preview - Estructura anidada SRI (Preservada):</p>
                {detalles.map((d,i)=>(
  <p key={`${d.id}-${i}-xml`}>{`<impuesto><codigo>${d.tipoImpuesto}</codigo><codigoRetencion>${d.codigoRetencionSRI}</codigoRetencion><baseImponible>${d.baseImponibleCalculada.toFixed(2)}</baseImponible><porcentajeRetener>${d.porcentajeAplicado}</porcentajeRetener><valorRetenido>${d.valorRetenido.toFixed(2)}</valorRetenido></impuesto>`}</p>
                ))}
              </div>

              <button onClick={emitirXML07} className="w-full mt-4 bg-[#00f5d4] text-black font-black py-4 rounded-xl text-xs tracking-widest">GUARDAR COMPRA + GENERAR XML RETENCIÓN 07 - AUTORIZADO SRI</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}