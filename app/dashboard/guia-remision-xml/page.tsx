"use client";
import { useState, useMemo, useEffect } from "react";

type ItemGuia = { id:string; codigo:string; descripcion:string; cantidadFactura:number; cantidadTransportada:number; };

type Destinatario = {
  id:string;
  ruc:string; razonSocial:string; dirDestino:string;
  motivoTraslado:string; codDocSustento:string; numDocSustento:string;
  numAutDocSustento:string; fechaEmisionDocSustento:string;
  items: ItemGuia[];
};

// CODIGOS SRI INTERNOS - EL CLIENTE SOLO VE EL NOMBRE LIMPIO
const MOTIVOS_SRI = [
  { code:"01", label:"Venta", hint:"Con factura" },
  { code:"02", label:"Compra", hint:"Compra de mercadería" },
  { code:"03", label:"Traslado entre locales", hint:"Misma empresa" },
  { code:"04", label:"Consignación", hint:"Entrega para venta" },
  { code:"05", label:"Devolución", hint:"Regreso de mercadería" },
  { code:"06", label:"Traslado entre bodegas", hint:"Movimiento interno" },
  { code:"07", label:"Importación", hint:"Mercadería importada" },
  { code:"08", label:"Transformación", hint:"Proceso productivo" },
];

const TIPOS_ID = [
  { code:"04", label:"RUC" },
  { code:"05", label:"Cédula" },
  { code:"06", label:"Pasaporte" },
];

const DOCS_SUSTENTO = [
  { code:"01", label:"Factura" },
  { code:"04", label:"Nota de Crédito" },
  { code:"03", label:"Liquidación de Compra" },
];

export default function GuiaRemisionPage(){
  const [razonSocialTransp, setRazonTransp] = useState("TRANS FLOTTA ORELLANA S.A.");
  const [tipoIdTransp, setTipoId] = useState("04");
  const [numIdTransp, setNumId] = useState("2290334234001");
  const [placa, setPlaca] = useState("PBA-1234");
  const [dirPartida, setDirPartida] = useState("BODEGA CENTRAL MEIJSAC, COCA - ORELLANA, AV. PAYAMINO");
  const [fechaIni, setFechaIni] = useState("2026-10-02T08:00");
  const [fechaFin, setFechaFin] = useState("2026-10-03T18:00");
  const [secuencialGuia, setSecGuia] = useState("001-001-000000001");
  const [verTecnico, setVerTecnico] = useState(false);

  const [destinatarios, setDests] = useState<Destinatario[]>([
    {
      id:"dest-1", ruc:"1792000000001", razonSocial:"CLIENTE INDUSTRIAL S.A.", dirDestino:"AV. 6 DE DICIEMBRE N45-123 QUITO",
      motivoTraslado:"01", codDocSustento:"01", numDocSustento:"001-001-000000125", numAutDocSustento:"1234567890", fechaEmisionDocSustento:"2026-10-02",
      items:[{ id:"1", codigo:"P-001", descripcion:"TUBERIA PVC 110MM X 6M", cantidadFactura:100, cantidadTransportada:50 }]
    }
  ]);

  const totalBultos = useMemo(()=> destinatarios.reduce((s,d)=> s + d.items.reduce((a,i)=>a+i.cantidadTransportada,0),0), [destinatarios]);

  const buscarCliente = (ruc:string, destId:string) => {
    const clientes = JSON.parse(localStorage.getItem("meijsac_clientes")||"[]");
    const c = clientes.find((x:any)=>x.ruc===ruc);
    if(c){
      setDests(prev=>prev.map(d=>d.id===destId?{...d, ruc:c.ruc, razonSocial:c.razonSocial, dirDestino:c.direccion}:d));
    }
  };

  const addDestinatario = () => {
    setDests([...destinatarios, {
      id:`dest-${Date.now()}`, ruc:"", razonSocial:"", dirDestino:"", motivoTraslado:"01", codDocSustento:"01", numDocSustento:"", numAutDocSustento:"", fechaEmisionDocSustento:new Date().toISOString().slice(0,10),
      items:[{ id:`item-${Date.now()}`, codigo:"", descripcion:"", cantidadFactura:0, cantidadTransportada:0 }]
    }]);
  };

  const addItem = (destId:string) => {
    setDests(prev=>prev.map(d=>d.id===destId?{...d, items:[...d.items, {id:`item-${Date.now()}`, codigo:"", descripcion:"", cantidadFactura:0, cantidadTransportada:0}]}:d));
  };

  const generarClave49 = () => {
    const fecha = new Date().toISOString().slice(0,10).replace(/-/g,"");
    return `${fecha}06${"2200000000001"}1${"001001"}${String(Math.floor(Math.random()*999999999)).padStart(9,"0")}${String(Math.floor(Math.random()*99999999)).padStart(8,"0")}1`;
  };

  const emitirGuia = () => {
    const clave = generarClave49();
    const payload = { secuencialGuia, claveAcceso:clave, transportista:{razonSocialTransp, tipoIdTransp, numIdTransp, placa}, dirPartida, fechaIni, fechaFin, destinatarios, totalBultos, estado:"AUTORIZADO" };
    const lista = JSON.parse(localStorage.getItem("meijsac_guias_06")||"[]");
    localStorage.setItem("meijsac_guias_06", JSON.stringify([...lista, {...payload, id:Date.now().toString(), fecha: new Date().toLocaleString()}]));
    alert(`✓ GUÍA AUTORIZADA\nN° ${secuencialGuia}\nPlaca: ${placa}\nDestinos: ${destinatarios.length}\nUnidades: ${totalBultos}`);
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white p-4">
      <div className="flex justify-between mb-4 max-w-7xl mx-auto">
        <h1 className="font-black text-sm tracking-tight">Guías de Remisión</h1>
        <button onClick={()=>location.href='/dashboard/comprobantes'} className="bg-white/10 px-4 py-2 rounded-xl text-xs">← Volver</button>
      </div>

      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-[#11131a] rounded-[24px] p-6 border border-white/5">
          <p className="text-[11px] font-bold tracking-widest text-white/60 uppercase mb-4">Datos del transporte</p>
          <div className="grid md:grid-cols-12 gap-4">
            <div className="md:col-span-4"><label className="text-[10px] text-white/50">Empresa de transporte / Chofer</label><input value={razonSocialTransp} onChange={e=>setRazonTransp(e.target.value.toUpperCase())} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm font-medium" /></div>
            <div className="md:col-span-2"><label className="text-[10px] text-white/50">Tipo de identificación</label><select value={tipoIdTransp} onChange={e=>setTipoId(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm">{TIPOS_ID.map(t=><option key={t.code} value={t.code}>{t.label}</option>)}</select></div>
            <div className="md:col-span-2"><label className="text-[10px] text-white/50">Número de identificación</label><input value={numIdTransp} onChange={e=>setNumId(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm font-mono" /></div>
            <div className="md:col-span-1"><label className="text-[10px] text-white/50">Placa</label><input value={placa} onChange={e=>setPlaca(e.target.value.toUpperCase())} placeholder="PBA-1234" className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm font-bold" /></div>
            <div className="md:col-span-3"><label className="text-[10px] text-white/50">Número de guía</label><input value={secuencialGuia} onChange={e=>setSecGuia(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm font-mono" /></div>
            <div className="md:col-span-6"><label className="text-[10px] text-white/50">Punto de partida</label><input value={dirPartida} onChange={e=>setDirPartida(e.target.value.toUpperCase())} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm" /></div>
            <div className="md:col-span-3"><label className="text-[10px] text-white/50">Inicio del traslado</label><input type="datetime-local" value={fechaIni} onChange={e=>setFechaIni(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm" /></div>
            <div className="md:col-span-3"><label className="text-[10px] text-white/50">Fin del traslado</label><input type="datetime-local" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} className="w-full mt-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm" /></div>
          </div>
        </div>

        <div className="bg-[#11131a] rounded-[24px] p-6 border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[11px] font-bold tracking-widest text-white/60 uppercase">Ruta y entregas</p>
            <button onClick={addDestinatario} className="bg-white text-black px-4 py-2 rounded-xl text-[11px] font-bold">+ Añadir destino</button>
          </div>

          <div className="space-y-5">
            {destinatarios.map((dest, idx)=>(
              <div key={`${dest.id}-${idx}`} className="bg-black rounded-2xl border border-white/10 p-5">
                <div className="flex justify-between mb-3"><span className="text-[10px] font-bold bg-white/10 text-white px-3 py-1 rounded-full">Entrega {idx+1}</span><button onClick={()=>setDests(destinatarios.filter(d=>d.id!==dest.id))} className="text-white/30 text-xs">Quitar</button></div>

                <div className="grid md:grid-cols-12 gap-3">
                  <div className="md:col-span-3"><label className="text-[10px] text-white/50">RUC del cliente</label><input value={dest.ruc} onChange={e=>{const v=e.target.value; setDests(prev=>prev.map(x=>x.id===dest.id?{...x, ruc:v}:x)); buscarCliente(v, dest.id);}} className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm font-mono" /></div>
                  <div className="md:col-span-4"><label className="text-[10px] text-white/50">Cliente</label><input value={dest.razonSocial} onChange={e=>setDests(prev=>prev.map(x=>x.id===dest.id?{...x, razonSocial:e.target.value.toUpperCase()}:x))} className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm" /></div>
                  <div className="md:col-span-5"><label className="text-[10px] text-white/50">Dirección de entrega</label><input value={dest.dirDestino} onChange={e=>setDests(prev=>prev.map(x=>x.id===dest.id?{...x, dirDestino:e.target.value.toUpperCase()}:x))} className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm" /></div>

                  <div className="md:col-span-3"><label className="text-[10px] text-white/50">Motivo del traslado</label><select value={dest.motivoTraslado} onChange={e=>setDests(prev=>prev.map(x=>x.id===dest.id?{...x, motivoTraslado:e.target.value}:x))} className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm">{MOTIVOS_SRI.map(m=><option key={m.code} value={m.code}>{m.label}</option>)}</select></div>
                  <div className="md:col-span-2"><label className="text-[10px] text-white/50">Documento que sustenta</label><select value={dest.codDocSustento} onChange={e=>setDests(prev=>prev.map(x=>x.id===dest.id?{...x, codDocSustento:e.target.value}:x))} className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm">{DOCS_SUSTENTO.map(d=><option key={d.code} value={d.code}>{d.label}</option>)}</select></div>
                  <div className="md:col-span-3"><label className="text-[10px] text-white/50">Número de factura / documento</label><input value={dest.numDocSustento} onChange={e=>setDests(prev=>prev.map(x=>x.id===dest.id?{...x, numDocSustento:e.target.value}:x))} placeholder="001-001-000000125" className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm font-mono" /></div>
                  <div className="md:col-span-2"><label className="text-[10px] text-white/50">Fecha del documento</label><input type="date" value={dest.fechaEmisionDocSustento} onChange={e=>setDests(prev=>prev.map(x=>x.id===dest.id?{...x, fechaEmisionDocSustento:e.target.value}:x))} className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm" /></div>
                  <div className="md:col-span-2"><label className="text-[10px] text-white/50">Autorización</label><input value={dest.numAutDocSustento} onChange={e=>setDests(prev=>prev.map(x=>x.id===dest.id?{...x, numAutDocSustento:e.target.value}:x))} className="w-full mt-1 bg-[#11131a] border border-white/10 rounded-xl px-3 py-3 text-sm font-mono" /></div>
                </div>

                <div className="mt-4 bg-[#11131a] rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-white/40 uppercase mb-2">Productos que van en el camión</p>
                  <div className="space-y-2">
                    {dest.items.map((it, i)=>(
                      <div key={`${it.id}-${i}`} className="grid md:grid-cols-12 gap-2 items-end bg-black p-2 rounded-xl">
                        <div className="md:col-span-2"><label className="text-[9px] text-white/30">Código</label><input value={it.codigo} onChange={e=>setDests(prev=>prev.map(d=>d.id===dest.id?{...d, items:d.items.map(x=>x.id===it.id?{...x, codigo:e.target.value.toUpperCase()}:x)}:d))} placeholder="P-001" className="w-full bg-[#11131a] border border-white/10 rounded-lg px-2 py-2 text-xs font-mono" /></div>
                        <div className="md:col-span-5"><label className="text-[9px] text-white/30">Producto</label><input value={it.descripcion} onChange={e=>setDests(prev=>prev.map(d=>d.id===dest.id?{...d, items:d.items.map(x=>x.id===it.id?{...x, descripcion:e.target.value.toUpperCase()}:x)}:d))} placeholder="Descripción" className="w-full bg-[#11131a] border border-white/10 rounded-lg px-2 py-2 text-xs" /></div>
                        <div className="md:col-span-2"><label className="text-[9px] text-white/30">Cantidad facturada</label><input type="number" value={it.cantidadFactura} onChange={e=>setDests(prev=>prev.map(d=>d.id===dest.id?{...d, items:d.items.map(x=>x.id===it.id?{...x, cantidadFactura:Number(e.target.value)}:x)}:d))} className="w-full bg-[#11131a] border border-white/10 rounded-lg px-2 py-2 text-xs font-mono" /></div>
                        <div className="md:col-span-2"><label className="text-[9px] text-white">Cantidad que se envía</label><input type="number" value={it.cantidadTransportada} onChange={e=>setDests(prev=>prev.map(d=>d.id===dest.id?{...d, items:d.items.map(x=>x.id===it.id?{...x, cantidadTransportada:Number(e.target.value)}:x)}:d))} className="w-full bg-[#11131a] border border-white/20 rounded-lg px-2 py-2 text-xs font-mono font-bold" /></div>
                        <div className="md:col-span-1 text-right"><button onClick={()=>setDests(prev=>prev.map(d=>d.id===dest.id?{...d, items:d.items.filter(x=>x.id!==it.id)}:d))} className="text-white/20 text-xs">✕</button></div>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>addItem(dest.id)} className="mt-2 bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-[10px]">+ Añadir producto</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-6 p-4 bg-white text-black rounded-xl">
            <p className="text-sm font-bold">{destinatarios.length} entregas • {totalBultos} unidades en camión • Placa {placa}</p>
            <p className="text-[11px] font-mono">{fechaIni} → {fechaFin}</p>
          </div>

          <div className="mt-4">
            <button onClick={()=>setVerTecnico(!verTecnico)} className="text-[10px] text-white/30 underline">{verTecnico? 'Ocultar detalle técnico' : 'Ver detalle técnico (solo admin)'}</button>
            {verTecnico && (
              <div className="mt-2 bg-black border border-white/5 rounded-xl p-3 font-mono text-[10px] text-white/40 overflow-auto">
                <p>{`<guiaRemision><infoGuiaRemision><dirPartida>${dirPartida}</dirPartida><placa>${placa}</placa></infoGuiaRemision>`}</p>
                {destinatarios.map(d=><p key={d.id}>{`<destinatario><motivo>${d.motivoTraslado}</motivo><numDoc>${d.numDocSustento}</numDoc><items>${d.items.reduce((s,i)=>s+i.cantidadTransportada,0)}</items></destinatario>`}</p>)}
              </div>
            )}
          </div>

          <button onClick={emitirGuia} className="w-full mt-4 bg-white text-black font-black py-4 rounded-xl text-sm">Generar Guía de Remisión</button>
        </div>
      </div>
    </div>
  );
}