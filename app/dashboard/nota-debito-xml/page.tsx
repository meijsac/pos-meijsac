"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const FACTURAS = [
  { num: "001-002-000000147", fecha: "2026-10-05", cliente: "Importadora Andina" },
  { num: "001-002-000000146", fecha: "2026-10-02", cliente: "Comercial Centro" },
];

export default function NotaDebitoPage() {
  const router = useRouter();
  const [numDoc, setNumDoc] = useState("001-002-000000147");
  const [fecha, setFecha] = useState("2026-10-05");
  const [motivos, setMotivos] = useState([{ id: "1", razon: "Intereses por mora 30 días", valor: 50 }]);
  const [iva, setIva] = useState(15);

  const totalSin = useMemo(()=> motivos.reduce((a,m)=>a+Number(m.valor||0),0), [motivos]);
  const vIva = totalSin * (iva/100);
  const vTotal = totalSin + vIva;

  return (
    <div className="min-h-screen bg-[#060608] text-white p-4">
      <button onClick={()=>router.push("/dashboard/comprobantes")} className="bg-white/10 border border-white/5 px-4 py-2 rounded-xl text-xs font-bold mb-4">← Volver</button>
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-xl font-black">NOTA DE DÉBITO <span className="text-[#00f5d4]">05</span></h1>

        <div className="bg-[#11131a] rounded-[20px] p-5 border border-white/5">
          <p className="text-[10px] text-white/50 uppercase font-bold mb-3 border-b border-white/5 pb-2">1. Vínculo Obligatorio Sustento</p>
          <div className="grid grid-cols-3 gap-3">
            <select value={numDoc} onChange={e=>setNumDoc(e.target.value)} className="bg-black border border-white/10 rounded-xl px-3 py-3 text-xs font-mono outline-none">
              {FACTURAS.map(f=><option key={f.num} value={f.num}>{f.num}</option>)}
            </select>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} className="bg-black border border-white/10 rounded-xl px-3 py-3 text-xs font-mono outline-none" />
            <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-3 text-xs font-mono text-white/50">01 - FACTURA</div>
          </div>
        </div>

        <div className="bg-[#11131a] rounded-[20px] p-5 border border-white/5">
          <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
            <p className="text-[10px] text-[#ffbe0a] uppercase font-bold">2. Motivos del Cargo Extra</p>
            <button onClick={()=>setMotivos([...motivos,{id:Date.now().toString(), razon:"", valor:0}])} className="text-[9px] bg-[#ffbe0a]/10 text-[#ffbe0a] px-3 py-1 rounded-full border border-[#ffbe0a]/20 font-bold">+ AGREGAR</button>
          </div>
          {motivos.map((m,i)=>(
            <div key={m.id} className="flex gap-2 mb-2 bg-black/30 p-3 rounded-xl border border-white/5">
              <input value={m.razon} onChange={e=>setMotivos(motivos.map(x=>x.id===m.id?{...x, razon:e.target.value}:x))} placeholder="Razon: Interes, Flete..." className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-xs outline-none" />
              <input type="number" value={m.valor} onChange={e=>setMotivos(motivos.map(x=>x.id===m.id?{...x, valor:parseFloat(e.target.value)||0}:x))} className="w-24 bg-black border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-right" />
              <button onClick={()=>setMotivos(motivos.filter(x=>x.id!==m.id))} className="text-white/20 px-2">✕</button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#11131a] border border-white/5 rounded-2xl p-4"><p className="text-[9px] text-white/40 uppercase font-bold">SIN IMPUESTOS</p><p className="text-xl font-mono font-black mt-1">${totalSin.toFixed(2)}</p></div>
          <div className="bg-[#11131a] border border-white/5 rounded-2xl p-4"><p className="text-[9px] text-white/40 uppercase font-bold">IVA {iva}%</p><p className="text-xl font-mono font-black mt-1">${vIva.toFixed(2)}</p></div>
          <div className="bg-[#00f5d4]/10 border border-[#00f5d4]/30 rounded-2xl p-4"><p className="text-[9px] text-[#00f5d4] uppercase font-bold">TOTAL</p><p className="text-xl font-mono font-black mt-1 text-[#00f5d4]">${vTotal.toFixed(2)}</p></div>
        </div>

        <button className="w-full bg-[#00f5d4] text-black font-black py-4 rounded-xl text-xs uppercase">GENERAR XML 05</button>
      </div>
    </div>
  );
}