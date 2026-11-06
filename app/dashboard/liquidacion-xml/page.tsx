"use client";
import { useState, useMemo, useEffect } from "react";

type Item = { id:string; codigo:string; descripcion:string; cantidad:number; precioUnitario:number; descuento:number; };

const TARIFA_IVA = 0.15;

export default function Liquidacion03Page(){
  const [tipoId, setTipoId] = useState<"05"|"06">("05");
  const [numId, setNumId] = useState("");
  const [nombres, setNombres] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoGasto, setTipoGasto] = useState<"BIENES"|"SERVICIOS">("BIENES");
  const [secuencial, setSecuencial] = useState("001-001-000000001");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().slice(0,10));
  const [verTecnico, setVerTecnico] = useState(false); // SOLO ADMIN

  const [items, setItems] = useState<Item[]>([
    { id:"1", codigo:"P-001", descripcion:"", cantidad:1, precioUnitario:0, descuento:0 }
  ]);

  const validarIdentificacion = (val:string) => {
    if(tipoId==="05" && val.length!==10) return "La cédula debe tener 10 dígitos";
    if(tipoId==="06" && val.length<6) return "Pasaporte inválido";
    if(tipoId==="05" &&!/^[0-9]{10}$/.test(val)) return "Solo números";
    return "";
  };
  const errorId = validarIdentificacion(numId);

  const subtotal = useMemo(()=> items.reduce((s,i)=> s + (i.cantidad * i.precioUnitario - i.descuento),0),[items]);
  const valorIva = useMemo(()=> subtotal * TARIFA_IVA,[subtotal]);
  const totalLiquidacion = useMemo(()=> subtotal + valorIva,[subtotal, valorIva]);

  const rentaConfig = tipoGasto==="BIENES"
  ? { porcentaje: 2, concepto: "Compra de bienes", codigoInterno:"312" }
    : { porcentaje: 2.75, concepto: "Servicio con mano de obra", codigoInterno:"320" };

  const retencionIva = valorIva;
  const retencionRenta = subtotal * (rentaConfig.porcentaje/100);
  const totalRetenciones = retencionIva + retencionRenta;
  const netoPagar = totalLiquidacion - totalRetenciones;

  const addItem = () => setItems([...items, { id:Date.now().toString(), codigo:"", descripcion:"", cantidad:1, precioUnitario:0, descuento:0 }]);

  const emitir = () => {
    if(errorId ||!nombres || subtotal===0){ alert("Completa cédula válida, nombre y productos"); return; }
    const clave03 = `${fechaEmision.replace(/-/g,"")}03${"2290334234001"}...`;

    const objetoFinal = {
      id: Date.now().toString(),
      tipo:"03",
      secuencial,
      fechaEmision,
      proveedor: { tipoId, numId, nombres, direccion, telefono },
      tipoGasto,
      detalle: items.map(i=>({
        codigoPrincipal: i.codigo,
        descripcion: i.descripcion.toUpperCase(),
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        descuento: i.descuento,
        precioTotalSinImpuesto: i.cantidad * i.precioUnitario - i.descuento,
        impuestos: [{ codigo:"2", codigoPorcentaje:"4", tarifa:15, baseImponible: i.cantidad * i.precioUnitario - i.descuento, valor: (i.cantidad * i.precioUnitario - i.descuento)*0.15 }]
      })),
      totales: { subtotal, valorIva, totalLiquidacion },
      autoRetencion07: {
        secuencialRet: secuencial,
        retenciones: [
          { tipo:"IVA", base: valorIva, porcentaje: 100, valor: retencionIva, codigoInterno:"2" },
          { tipo:"RENTA", base: subtotal, porcentaje: rentaConfig.porcentaje, valor: retencionRenta, codigoInterno: rentaConfig.codigoInterno }
        ],
        totalRetenciones
      },
      netoPagar,
      estado:"AUTORIZADO"
    };

    const lista = JSON.parse(localStorage.getItem("meijsac_liquidaciones_03")||"[]");
    localStorage.setItem("meijsac_liquidaciones_03", JSON.stringify([...lista, objetoFinal]));
    alert(`✓ LIQUIDACIÓN 03 + RETENCIÓN 07 EMITIDAS\nNeto a entregar en mano: $${netoPagar.toFixed(2)}\nRetención IVA 100%: $${retencionIva.toFixed(2)}`);
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex justify-between"><h1 className="font-black text-sm">Liquidación de Compra</h1><button onClick={()=>location.href='/dashboard/comprobantes'} className="bg-white/10 px-4 py-2 rounded-xl text-xs">← Volver</button></div>

        <div className="bg-[#11131a] rounded-[24px] p-6 border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[11px] font-bold tracking-widest text-white/60 uppercase">Proveedor informal</p>
            <div className="flex bg-black rounded-full p-1 border border-white/10">
              <button onClick={()=>setTipoGasto("BIENES")} className={`px-4 py-2 rounded-full text-[11px] font-bold transition ${tipoGasto==="BIENES"?'bg-white text-black':'text-white/40'}`}>Compra de Bienes</button>
              <button onClick={()=>setTipoGasto("SERVICIOS")} className={`px-4 py-2 rounded-full text-[11px] font-bold transition ${tipoGasto==="SERVICIOS"?'bg-white text-black':'text-white/40'}`}>Contratación de Servicios</button>
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-4">
            <div className="md:col-span-2"><label className="text-[10px] text-white/50">Tipo de documento</label><select value={tipoId} onChange={e=>setTipoId(e.target.value as any)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm"><option value="05">Cédula</option><option value="06">Pasaporte</option></select><p className="text-[9px] text-white/20 mt-1">No aplica RUC en este documento</p></div>
            <div className="md:col-span-3"><label className="text-[10px] text-white/50">Número de identificación</label><input value={numId} onChange={e=>setNumId(e.target.value)} placeholder={tipoId==="05"?"1723456789":"P123456"} className={`w-full mt-1 bg-black border rounded-xl px-3 py-3 text-sm font-mono ${errorId?'border-red-500/50':'border-white/10'}`} /><p className="text-[9px] text-red-400 mt-1">{errorId}</p></div>
            <div className="md:col-span-4"><label className="text-[10px] text-white/50">Nombres completos del proveedor</label><input value={nombres} onChange={e=>setNombres(e.target.value.toUpperCase())} placeholder="Ej: JUAN PEREZ" className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm uppercase" /></div>
            <div className="md:col-span-3"><label className="text-[10px] text-white/50">Fecha y número</label><div className="flex gap-2 mt-1"><input type="date" value={fechaEmision} onChange={e=>setFechaEmision(e.target.value)} className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm" /><input value={secuencial} onChange={e=>setSecuencial(e.target.value)} className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-xs font-mono" /></div></div>
          </div>
        </div>

        <div className="bg-[#11131a] rounded-[24px] p-6 border border-white/5">
          <p className="text-[11px] font-bold tracking-widest text-white/60 uppercase mb-3">Detalle de la compra</p>
          <div className="space-y-2">
            {items.map((it,i)=>(
              <div key={it.id} className="grid md:grid-cols-12 gap-2 bg-black p-3 rounded-xl border border-white/5">
                <div className="md:col-span-2"><input value={it.codigo} onChange={e=>setItems(items.map(x=>x.id===it.id?{...x, codigo:e.target.value}:x))} placeholder="Código" className="w-full bg-[#11131a] border border-white/10 rounded-lg px-2 py-2 text-xs font-mono" /></div>
                <div className="md:col-span-4"><input value={it.descripcion} onChange={e=>setItems(items.map(x=>x.id===it.id?{...x, descripcion:e.target.value}:x))} placeholder="Descripción del bien o servicio" className="w-full bg-[#11131a] border border-white/10 rounded-lg px-2 py-2 text-xs" /></div>
                <div className="md:col-span-1"><input type="number" value={it.cantidad} onChange={e=>setItems(items.map(x=>x.id===it.id?{...x, cantidad:Number(e.target.value)}:x))} className="w-full bg-[#11131a] border border-white/10 rounded-lg px-2 py-2 text-xs" /></div>
                <div className="md:col-span-2"><input type="number" value={it.precioUnitario} onChange={e=>setItems(items.map(x=>x.id===it.id?{...x, precioUnitario:Number(e.target.value)}:x))} placeholder="Precio" className="w-full bg-[#11131a] border border-white/10 rounded-lg px-2 py-2 text-xs" /></div>
                <div className="md:col-span-2"><div className="bg-white/5 rounded-lg px-2 py-2 text-xs font-mono text-right">${((it.cantidad * it.precioUnitario)-it.descuento).toFixed(2)}</div></div>
                <div className="md:col-span-1 text-right"><button onClick={()=>setItems(items.filter(x=>x.id!==it.id))} className="text-white/20 text-xs">✕</button></div>
              </div>
            ))}
          </div>
          <button onClick={addItem} className="mt-3 bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-[11px]">+ Añadir ítem</button>
        </div>

        <div className="bg-[#0a0e12] rounded-[24px] p-6 border border-[#00f5d4]/20">
          <p className="text-[11px] font-bold tracking-widest text-[#00f5d4] uppercase mb-3">Auto-retenciones generadas automáticamente</p>
          <p className="text-[10px] text-white/40 mb-4">El sistema calcula y bloquea estos valores según la normativa vigente. No requiere intervención.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-black rounded-xl p-4 border border-white/10 flex justify-between items-center">
              <div><p className="text-[10px] text-white/50">Retención de IVA</p><p className="text-sm font-bold">100% del IVA</p><p className="text-[9px] text-white/30">Base: ${valorIva.toFixed(2)}</p></div>
              <p className="text-lg font-black text-[#00f5d4]">${retencionIva.toFixed(2)}</p>
            </div>
            <div className="bg-black rounded-xl p-4 border border-white/10 flex justify-between items-center">
              <div><p className="text-[10px] text-white/50">Retención de Renta</p><p className="text-sm font-bold">{rentaConfig.porcentaje}% - {rentaConfig.concepto}</p><p className="text-[9px] text-white/30">Base: ${subtotal.toFixed(2)}</p></div>
              <p className="text-lg font-black text-white">${retencionRenta.toFixed(2)}</p>
            </div>
          </div>

          {/* CODIGO TECNICO AHORA SOLO PARA ADMIN - OCULTO AL CLIENTE */}
          <button onClick={()=>setVerTecnico(!verTecnico)} className="mt-3 text-[9px] text-white/20 underline">{verTecnico?'Ocultar detalle técnico':'Ver detalle técnico (admin)'}</button>
          {verTecnico && (
            <div className="mt-2 bg-[#00f5d4]/10 border border-[#00f5d4]/20 rounded-xl p-3 font-mono text-[10px] text-[#00f5d4]/60">
              XML interno: &lt;retencion&gt;&lt;codigo&gt;2&lt;/codigo&gt;&lt;base&gt;{valorIva.toFixed(2)}&lt;/base&gt;&lt;porcentaje&gt;100&lt;/porcentaje&gt;&lt;/retencion&gt; + &lt;codigo&gt;1&lt;/codigo&gt;&lt;base&gt;{subtotal.toFixed(2)}&lt;/base&gt;&lt;porcentaje&gt;{rentaConfig.porcentaje}&lt;/porcentaje&gt; [Cod. {rentaConfig.codigoInterno}]
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[#11131a] rounded-2xl p-5 border border-white/5"><p className="text-[10px] text-white/40 uppercase">Total liquidación (Bruto)</p><p className="text-2xl font-black mt-1">${totalLiquidacion.toFixed(2)}</p><p className="text-[10px] text-white/30 mt-1">Subtotal ${subtotal.toFixed(2)} + IVA ${valorIva.toFixed(2)}</p></div>
          <div className="bg-[#11131a] rounded-2xl p-5 border border-red-500/20"><p className="text-[10px] text-red-400 uppercase">Total retenciones (Freno fiscal)</p><p className="text-2xl font-black mt-1 text-red-400">-${totalRetenciones.toFixed(2)}</p><p className="text-[10px] text-white/30 mt-1">IVA 100% + Renta {rentaConfig.porcentaje}%</p></div>
          <div className="bg-[#00f5d4] rounded-2xl p-5 text-black shadow-[0_0_30px_rgba(0,245,212,0.3)]"><p className="text-[10px] font-black uppercase opacity-60">Monto neto a entregar en mano</p><p className="text-3xl font-black mt-1">${netoPagar.toFixed(2)}</p><p className="text-[10px] font-bold mt-1 opacity-60">Sale de caja chica para pagar al proveedor</p></div>
        </div>

        <button onClick={emitir} className="w-full bg-[#00f5d4] text-black font-black py-5 rounded-2xl text-sm tracking-widest">GUARDAR LIQUIDACIÓN + EMITIR AUTO-RETENCIÓN ELECTRÓNICA</button>
      </div>
    </div>
  );
}