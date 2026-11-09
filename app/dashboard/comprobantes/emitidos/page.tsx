"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

// === COMPONENTE CHISMOSO - NO BORRA NADA ===
function Chismoso({ children, texto, pos="top" }:{children:any, texto:string, pos?:string}){
  return (
    <div className="relative group inline-flex">
      {children}
      <div className={`absolute ${pos==="top"?"bottom-full mb-2":"top-full mt-2"} left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none w-max max-w-[280px]`}>
        <div className="bg-black border border-[#00f5d4]/40 text-white text-[10px] leading-tight px-3 py-2 rounded-xl shadow-2xl whitespace-normal text-center">
          {texto}
        </div>
        <div className={`w-2 h-2 bg-black border-r border-b border-[#00f5d4]/40 rotate-45 -mt-1 ${pos==="top"?"":"rotate-[225deg] -mb-1 mt-0"}`}></div>
      </div>
    </div>
  )
}

// === CONFIG EMPRESA GENERICA - PARA VENDER A CUALQUIER CLIENTE ===
function useEmpresa(){
  const getEmpresa = () => {
    try{
      const saved = JSON.parse(localStorage.getItem("meijsac_empresa_config") || "null")
      if(saved) return saved
    }catch{}
    return {
      ruc: "1799999999001",
      razonSocial: "MEIJSAC FACTURACION",
      nombreComercial: "Mi Negocio",
      direccionMatriz: "Quito - Ecuador",
      actividadEconomica: "ACTIVIDAD ECONOMICA GENERAL",
      obligadoContabilidad: "SI",
      tipoImpresora: "80mm"
    }
  }
  const [empresa] = useState(getEmpresa)
  return empresa
}

interface ComprobanteHistorialSRI {
  id: string;
  tipoComprobante: '01' | '04' | '05' | '06' | '07';
  secuencial: string;
  claveAcceso: string;
  fechaEmision: string;
  fechaISO?: string;
  receptorIdentificacion: string;
  receptorNombre: string;
  valorTotal: number;
  estadoSRI: 'AUTORIZADO' | 'PENDIENTE' | 'ANULADO' | 'PENDIENTE_DE_AUTORIZAR' | 'BORRADOR';
  motivoAnulacion?: string;
  fechaAnulacion?: string;
  xmlContent?: string;
  intentos?: number;
}

export default function EmitidosPage(){
  const router = useRouter()
  const empresa = useEmpresa()
  const [docs,setDocs]=useState<ComprobanteHistorialSRI[]>([])
  const [filtro,setFiltro]=useState("")
  const [showAnular,setShowAnular]=useState<ComprobanteHistorialSRI|null>(null)
  const [borradores,setBorradores]=useState<any[]>([])
  const [pendientes,setPendientes]=useState<ComprobanteHistorialSRI[]>([])

  // 1. INYECCION UNIFICADA - Lee todas las llaves
  const cargar = ()=>{
    const get = (k:string)=>{ try{ return JSON.parse(localStorage.getItem(k)||"[]") }catch{ return [] } }
    
    const fuentes = [
      ...get("meijsac_comprobantes_sri"),
      ...get("meijsac_comprobantes_emitidos"),
      ...get("meijsac_documentos_emitidos"),
      ...get("meijsac_facturas"),
      ...get("meijsac_ventas_pos"),
      ...get("meijsac_restaurante_facturas"),
      ...get("meijsac_enviados_sri"),
      ...get("meijsac_comprobantes_pendientes_sri"),
      ...get("meijsac_retenciones").map((r:any)=>({
        id: r.id, tipoComprobante:'07', secuencial:r.numRetencion||r.secuencial,
        claveAcceso: r.claveAccesoSustento||r.clave, fechaEmision: r.fechaGeneracion||r.fecha,
        receptorIdentificacion: r.proveedorRuc||r.ruc, receptorNombre: r.proveedorNombre||r.razon,
        valorTotal: (Number(r.valorRetRenta)||0)+(Number(r.valorRetIva)||0), estadoSRI: r.estado||'AUTORIZADO',
        xmlContent: r.xml
      }))
    ]

    const unificados: ComprobanteHistorialSRI[] = fuentes.map((d:any,i:number)=>({
      id: d.id || `doc-${i}-${d.secuencial}`,
      tipoComprobante: d.tipoComprobante || (d.tipo?.includes('07')?'07':d.tipo?.includes('04')?'04':d.tipo?.includes('05')?'05':d.tipo?.includes('06')?'06':'01'),
      secuencial: d.secuencial || d.numRetencion || `001-001-00000${i}`,
      claveAcceso: d.claveAcceso || d.clave || d.claveAccesoSustento || `000000000000000000000000${i}`,
      fechaEmision: d.fechaEmision || d.fecha || d.fechaGeneracion || new Date().toLocaleDateString('es-EC'),
      fechaISO: d.fechaISO || d.fechaCreacion || new Date().toISOString(),
      receptorIdentificacion: d.receptorIdentificacion || d.ruc || d.rucProveedor || d.receptorRuc || "9999999999999",
      receptorNombre: d.receptorNombre || d.razon || d.proveedor || d.proveedorNombre || "CONSUMIDOR FINAL",
      valorTotal: Number(d.valorTotal ?? d.total ?? d.valorRetenido ?? 0),
      estadoSRI: d.estadoSRI || d.estado || 'AUTORIZADO',
      xmlContent: d.xmlContent || d.xml || "",
      motivoAnulacion: d.motivoAnulacion,
      fechaAnulacion: d.fechaAnulacion,
      intentos: d.intentos || 0
    }))

    const map = new Map()
    unificados.forEach(d=>{ 
      if(!map.has(d.secuencial) || d.estadoSRI==='AUTORIZADO') map.set(d.secuencial,d) 
    })
    const todos = Array.from(map.values()).reverse()
    setDocs(todos)
    setPendientes(todos.filter(d=> d.estadoSRI==='PENDIENTE_DE_AUTORIZAR' || d.estadoSRI==='PENDIENTE'))
    setBorradores(get("meijsac_borradores_facturas"))
  }

  useEffect(()=>{ cargar() },[])

  // 2. WATCHER AUTOMATICO - PENDIENTES AL SRI (GENÉRICO)
  useEffect(()=>{
    const SRI_API = "/api/sri/enviar"
    const autorizarUno = async (doc:ComprobanteHistorialSRI) => {
      if(!navigator.onLine) return false
      try{
        const res = await fetch(SRI_API, {
          method: 'POST',
          body: JSON.stringify({ xml: doc.xmlContent, clave: doc.claveAcceso }),
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await res.json()
        if(data.estado === 'AUTORIZADO'){
          const keys = ["meijsac_comprobantes_pendientes_sri","meijsac_comprobantes_sri","meijsac_comprobantes_emitidos","meijsac_ventas_pos","meijsac_facturas"]
          keys.forEach(k=>{
            const lista = JSON.parse(localStorage.getItem(k)||"[]")
            const nueva = lista.map((d:any)=> d.claveAcceso===doc.claveAcceso || d.secuencial===doc.secuencial ? {...d, estadoSRI:'AUTORIZADO', fechaAutorizacion: new Date().toISOString()} : d)
            localStorage.setItem(k, JSON.stringify(nueva))
          })
          const colaActual = JSON.parse(localStorage.getItem("meijsac_comprobantes_pendientes_sri")||"[]")
          localStorage.setItem("meijsac_comprobantes_pendientes_sri", JSON.stringify(colaActual.filter((d:any)=>d.claveAcceso!==doc.claveAcceso && d.secuencial!==doc.secuencial)))
          return true
        }
      }catch{}
      return false
    }

    const procesarCola = async () => {
      const cola = JSON.parse(localStorage.getItem("meijsac_comprobantes_pendientes_sri")||"[]")
      if(cola.length===0 || !navigator.onLine) return
      for(const doc of cola){ await autorizarUno(doc); await new Promise(r=>setTimeout(r,2000)) }
      cargar()
    }

    const interval = setInterval(procesarCola, 60000)
    window.addEventListener('online', procesarCola)
    window.addEventListener('focus', procesarCola)
    procesarCola()
    return ()=>{ clearInterval(interval); window.removeEventListener('online', procesarCola); window.removeEventListener('focus', procesarCola) }
  },[])

  // 3. BOTONERA DE DESPACHO - GENERICA
  const descargarXML = (doc:ComprobanteHistorialSRI)=>{
    const xmlReal = doc.xmlContent || `<?xml version="1.0" encoding="UTF-8"?>
<comprobante id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>1</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${empresa.razonSocial}</razonSocial>
    <claveAcceso>${doc.claveAcceso}</claveAcceso>
    <codDoc>${doc.tipoComprobante}</codDoc>
    <estab>${doc.secuencial.split('-')[0]||'001'}</estab>
    <ptoEmi>${doc.secuencial.split('-')[1]||'001'}</ptoEmi>
    <secuencial>${doc.secuencial.split('-').pop()}</secuencial>
    <dirMatriz>${empresa.direccionMatriz}</dirMatriz>
  </infoTributaria>
  <infoAdicional>
    <campoAdicional nombre="RECEPTOR">${doc.receptorNombre}</campoAdicional>
    <campoAdicional nombre="RUC">${doc.receptorIdentificacion}</campoAdicional>
    <numeroAutorizacion>${doc.claveAcceso}</numeroAutorizacion>
    <fechaAutorizacion>${doc.fechaEmision}</fechaAutorizacion>
    <estado>${doc.estadoSRI}</estado>
  </infoAdicional>
  <detalles><total>${doc.valorTotal}</total></detalles>
</comprobante>`
    const blob = new Blob([xmlReal],{type:'application/xml;charset=utf-8'});
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; 
    a.download=`${doc.tipoComprobante}-${doc.secuencial}-${doc.receptorNombre.substring(0,15).replace(/\s/g,'_')}.xml`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }

  const descargarPDF = (doc:ComprobanteHistorialSRI)=>{
    const html = `
      <html><head><title>RIDE ${doc.secuencial}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#000;background:#fff}
        .header{display:flex;justify-content:space-between;border:2px solid #000;padding:12px}
        .barcode{margin-top:20px;font-family:monospace;letter-spacing:1px;text-align:center;border:1px dashed #000;padding:10px;word-break:break-all;font-size:10px}
        .anulado{color:red;border:4px solid red;text-align:center;font-weight:900;font-size:34px;transform:rotate(-18deg);opacity:0.25;position:absolute;top:38%;left:22%;padding:10px 40px;z-index:10}
        .pendiente{color:#ffbe0a;border:4px solid #ffbe0a;text-align:center;font-weight:900;font-size:28px;transform:rotate(-18deg);opacity:0.3;position:absolute;top:38%;left:18%;padding:10px 30px;z-index:10}
        table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #000;padding:6px;text-align:left}
      </style></head><body>
      ${doc.estadoSRI==='ANULADO'?'<div class="anulado">ANULADO EN SRI</div>':''}
      ${doc.estadoSRI==='PENDIENTE_DE_AUTORIZAR' || doc.estadoSRI==='PENDIENTE'?'<div class="pendiente">PENDIENTE DE AUTORIZAR</div>':''}
      <div class="header">
        <div><b style="font-size:14px">${empresa.razonSocial}</b><br/>RUC: ${empresa.ruc}<br/>Dir Matriz: ${empresa.direccionMatriz}<br/>Obligado: ${empresa.obligadoContabilidad}<br/><br/>Cliente: ${doc.receptorNombre}</div>
        <div style="text-align:right"><b>RIDE - ${doc.tipoComprobante==='07'?'RETENCION':'FACTURA'} ${doc.tipoComprobante}</b><br/>No. ${doc.secuencial}<br/>Clave Acceso:<br/><span style="font-size:9px">${doc.claveAcceso}</span><br/>Fecha: ${doc.fechaEmision}<br/>Estado: ${doc.estadoSRI}</div>
      </div>
      <p><b>Receptor:</b> ${doc.receptorNombre}<br/><b>RUC/CI:</b> ${doc.receptorIdentificacion}<br/><b>Fecha:</b> ${doc.fechaEmision} (Fecha actual forzada por norma SRI)</p>
      <table><tr><th>Detalle</th><th>Valor</th></tr><tr><td>Valor Total Documento</td><td style="font-weight:900">$${doc.estadoSRI==='ANULADO'?'0.00':doc.valorTotal.toFixed(2)}</td></tr></table>
      <div class="barcode">CLAVE ACCESO<br/>${doc.claveAcceso}<br/><br/>NUM AUTORIZACION: ${doc.claveAcceso}</div>
      <p style="font-size:8px;opacity:0.5;margin-top:20px">Documento desde COMPROBANTES EMITIDOS - ${empresa.nombreComercial} - ${new Date().toLocaleString()}</p>
      <script>setTimeout(()=>{window.print()},400)</script>
      </body></html>`
    const w=window.open('','','width=900,height=950'); 
    if(!w){ alert("Activa popups del navegador para descargar PDF en EMITIDOS"); return }
    w.document.open(); w.document.write(html); w.document.close()
  }

  const descargarTicket = (doc:ComprobanteHistorialSRI)=>{
    if(doc.tipoComprobante==='07' || doc.tipoComprobante==='06'){ alert(`Documentos tipo ${doc.tipoComprobante} por normativa SRI solo se permiten en formato RIDE A4`); return }
    const w=window.open('','','width=320,height=650'); if(!w) return
    w.document.write(`<html><body style="width:80mm;font-family:monospace;font-size:11px;text-align:center;padding:10px"><b>${empresa.nombreComercial}</b><br/>${empresa.razonSocial}<br/>RUC: ${empresa.ruc}<br/>${doc.secuencial}<br/>${doc.fechaEmision}<br/>${doc.receptorNombre}<br/>--------------------------<br/>TOTAL: $${doc.valorTotal.toFixed(2)}<br/>--------------------------<br/><span style="font-size:8px">${doc.claveAcceso.slice(0,25)}...</span><br/><script>setTimeout(()=>window.print(),400)</script></body></html>`)
  }

  const anularLogico = ()=>{
    if(!showAnular) return
    const todosKeys = ["meijsac_comprobantes_sri","meijsac_comprobantes_emitidos","meijsac_documentos_emitidos","meijsac_facturas","meijsac_retenciones","meijsac_ventas_pos","meijsac_restaurante_facturas","meijsac_enviados_sri","meijsac_comprobantes_pendientes_sri"]
    todosKeys.forEach(k=>{
      const lista = JSON.parse(localStorage.getItem(k)||"[]")
      const nueva = lista.map((d:any)=>{
        const sec = d.secuencial || d.numRetencion
        if(sec===showAnular.secuencial){
          return {...d, estadoSRI:'ANULADO', estado:'ANULADO', motivoAnulacion:'Anulado en SRI en Linea', fechaAnulacion: new Date().toISOString(), valorTotal:0, total:0, valorRetenido:0}
        }
        return d
      })
      localStorage.setItem(k, JSON.stringify(nueva))
    })
    setShowAnular(null)
    cargar()
  }

  const filtrados = useMemo(()=>docs.filter(d=> d.secuencial.includes(filtro) || d.receptorNombre.toLowerCase().includes(filtro.toLowerCase())),[docs,filtro])

  return (
    <div className="min-h-screen bg-[#060608] text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <Chismoso texto="Regresa al hub principal de comprobantes"><button onClick={()=>router.push("/dashboard/comprobantes")} className="bg-white text-black px-4 py-2 rounded-xl text-xs font-bold">← Volver a COMPROBANTES</button></Chismoso>
        <Chismoso texto="Historial maestro unificado para cualquier actividad económica"><h1 className="font-black tracking-tight">COMPROBANTES EMITIDOS - {docs.length} DOCS - {empresa.nombreComercial}</h1></Chismoso>
        <Chismoso texto="Filtra por secuencial o por cliente/proveedor"><input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar secuencial / cliente" className="bg-black border border-white/10 rounded-xl px-4 py-2 text-xs w-[240px]" /></Chismoso>
      </div>

      {/* SECCION BORRADORES - FECHA SIEMPRE HOY NORMA SRI */}
      {borradores.length>0 && (
        <div className="bg-[#ffbe0a]/10 border border-[#ffbe0a]/30 rounded-[20px] p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-black text-[12px] text-[#ffbe0a] tracking-widest">📝 BORRADORES SIN EMITIR - {borradores.length} - ¡NO OLVIDAR!</h2>
            <Chismoso texto="Por norma SRI la factura electrónica debe emitirse con fecha de hoy. No se puede antedatar ni postdatar"><span className="text-[9px] bg-[#ffbe0a] text-black px-2 py-1 rounded-full font-black">FECHA FORZADA HOY: {new Date().toLocaleDateString('es-EC')} ⓘ</span></Chismoso>
          </div>
          <div className="grid gap-2">
            {borradores.map((b:any)=>(
              <div key={b.id} className="grid grid-cols-12 p-3 bg-black/40 rounded-xl text-[11px] items-center border border-[#ffbe0a]/20">
                <div className="col-span-1"><span className="bg-[#ffbe0a] text-black px-2 py-1 rounded-full text-[9px] font-black">BORRADOR</span></div>
                <div className="col-span-2 font-mono text-[#ffbe0a]">{b.secuencialTemp || b.secuencial}</div>
                <div className="col-span-3 truncate">{b.receptorNombre} - {b.receptorRuc || b.receptorIdentificacion}</div>
                <div className="col-span-2 text-[10px] opacity-60">Creado: {new Date(b.fechaCreacion || b.fechaISO || Date.now()).toLocaleString('es-EC')}</div>
                <div className="col-span-1 font-black">${Number(b.total || b.valorTotal || 0).toFixed(2)}</div>
                <div className="col-span-3 flex justify-end gap-1">
                  <Chismoso texto="Retoma la factura. La fecha se actualizará a HOY automáticamente por norma SRI">
                    <button onClick={()=>{
                      localStorage.setItem("meijsac_borrador_activo", JSON.stringify(b))
                      router.push("/dashboard/factura-xml?borrador="+b.id)
                    }} className="bg-[#ffbe0a] text-black px-3 py-1 rounded-lg text-[10px] font-black hover:scale-105">✏️ CONTINUAR</button>
                  </Chismoso>
                  <button onClick={()=>{ const list = borradores.filter((x:any)=>x.id!==b.id); localStorage.setItem("meijsac_borradores_facturas", JSON.stringify(list)); setBorradores(list) }} className="bg-white/10 px-2 py-1 rounded-lg text-[10px]">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCION PENDIENTES - AUTO SRI */}
      {pendientes.length>0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-[20px] p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-black text-[12px] text-yellow-400 tracking-widest">⏳ PENDIENTES DE AUTORIZAR - {pendientes.length} - SE ENVIAN SOLOS AL VOLVER INTERNET/LUZ/SRI</h2>
            <span className="text-[9px] bg-yellow-400 text-black px-2 py-1 rounded-full font-black animate-pulse">AUTO-SYNC: 60s + online + focus</span>
          </div>
          <div className="grid gap-2">
            {pendientes.map((p:any)=>(
              <div key={p.id} className="grid grid-cols-12 p-3 bg-black/40 rounded-xl text-[11px] items-center border border-yellow-500/20">
                <div className="col-span-1"><span className="bg-yellow-500 text-black px-2 py-1 rounded-full text-[9px] font-black">{p.tipoComprobante}</span></div>
                <div className="col-span-2 font-mono text-yellow-400">{p.secuencial}</div>
                <div className="col-span-3 truncate">{p.receptorNombre}</div>
                <div className="col-span-2 text-[10px] opacity-60">Intentos: {p.intentos || 0}</div>
                <div className="col-span-1 font-black">${Number(p.valorTotal).toFixed(2)}</div>
                <div className="col-span-3 flex justify-end gap-1">
                  <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-[9px]">⏳ {p.estadoSRI}</span>
                  <Chismoso texto="Reintentar ahora mismo contra SRI"><button onClick={async()=>{
                    const res = await fetch("/api/sri/enviar",{method:'POST',body:JSON.stringify({xml:p.xmlContent, clave:p.claveAcceso}), headers:{'Content-Type':'application/json'}})
                    cargar()
                  }} className="bg-white text-black px-2 py-1 rounded-lg text-[10px] font-bold">🔄</button></Chismoso>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#11131a] rounded-[20px] border border-white/10 overflow-hidden">
        <div className="grid grid-cols-12 p-3 text-[10px] opacity-40 font-black tracking-widest">
          <div className="col-span-1"><Chismoso texto="01=Factura, 04=Nota Crédito, 05=Nota Débito, 06=Guía, 07=Retención" pos="bottom">TIPO ⓘ</Chismoso></div>
          <div className="col-span-2"><Chismoso texto="Numeración SRI 001-001-000000007" pos="bottom">SECUENCIAL ⓘ</Chismoso></div>
          <div className="col-span-3"><Chismoso texto="Cliente o proveedor según tipo" pos="bottom">RECEPTOR ⓘ</Chismoso></div>
          <div className="col-span-1"><Chismoso texto="Si está ANULADO pasa a $0.00" pos="bottom">TOTAL ⓘ</Chismoso></div>
          <div className="col-span-1"><Chismoso texto="AUTORIZADO, PENDIENTE, ANULADO" pos="bottom">ESTADO ⓘ</Chismoso></div>
          <div className="col-span-4 text-right"><Chismoso texto="Descargas SRI válidas" pos="bottom">ACCIONES ⓘ</Chismoso></div>
        </div>
        {filtrados.map((d,i)=>(
          <div key={i} className={`grid grid-cols-12 p-3 border-t border-white/5 text-[11px] items-center hover:bg-white/[0.03] ${d.estadoSRI==='ANULADO'?'opacity-40 grayscale':''}`}>
            <div className="col-span-1"><Chismoso texto={`${d.tipoComprobante} - ${d.tipoComprobante==='07'?'Retención':'Factura'}`}><span className={`px-2 py-1 rounded-full text-[9px] font-black ${d.tipoComprobante==='07'?'bg-orange-500/20 text-orange-400 border border-orange-500/30': d.estadoSRI==='ANULADO'?'bg-red-500/20 text-red-400' : d.estadoSRI.includes('PENDIENTE')?'bg-yellow-500/20 text-yellow-400' : 'bg-[#ffbe0a]/20 text-[#ffbe0a]'}`}>{d.tipoComprobante} - {d.tipoComprobante==='07'?'RET':d.tipoComprobante==='01'?'FAC':'DOC'}</span></Chismoso></div>
            <div className="col-span-2"><Chismoso texto={`Clave: ${d.claveAcceso}`}><span className="font-mono font-bold text-[#ffbe0a]">{d.secuencial}</span></Chismoso></div>
            <div className="col-span-3 truncate"><Chismoso texto={`RUC: ${d.receptorIdentificacion}`}><span>{d.receptorNombre} <span className="opacity-30">{d.receptorIdentificacion.slice(0,10)}</span></span></Chismoso></div>
            <div className="col-span-1"><span className="font-black">${d.estadoSRI==='ANULADO'?'0.00':d.valorTotal.toFixed(2)}</span></div>
            <div className="col-span-1"><span className={`px-2 py-1 rounded-full text-[9px] font-black ${d.estadoSRI==='AUTORIZADO'?'bg-emerald-500/20 text-emerald-400': d.estadoSRI==='ANULADO'?'bg-zinc-700 text-zinc-400':'bg-yellow-500/20 text-yellow-400'}`}>{d.estadoSRI==='ANULADO'?'🚫 ANULADO': d.estadoSRI.includes('PENDIENTE')?'⏳ PENDIENTE':`✓ ${d.estadoSRI}`}</span></div>
            <div className="col-span-4 flex justify-end gap-1">
              <Chismoso texto="RIDE A4 oficial"><button onClick={()=>descargarPDF(d)} className="bg-white text-black px-2 py-1 rounded-lg text-[10px] font-bold hover:scale-105">📄 PDF</button></Chismoso>
              <Chismoso texto="Ticket 80mm - solo 01,04,05"><button onClick={()=>descargarTicket(d)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${d.tipoComprobante==='01' || d.tipoComprobante==='04' || d.tipoComprobante==='05'?'bg-[#00f5d4] text-black hover:scale-105':'bg-white/10 text-white/20 cursor-not-allowed'}`}>🧾 TICK</button></Chismoso>
              <Chismoso texto="XML con autorización"><button onClick={()=>descargarXML(d)} className="bg-[#3a86ff] text-white px-2 py-1 rounded-lg text-[10px] font-bold hover:scale-105">📁 XML</button></Chismoso>
              <button onClick={()=>setShowAnular(d)} className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg text-[10px] font-black hover:bg-red-500 hover:text-white">🚫</button>
            </div>
          </div>
        ))}
      </div>

      {showAnular && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-[#11131a] border border-red-500/30 rounded-[24px] p-6 max-w-[460px] w-full shadow-2xl">
            <h2 className="font-black text-red-400 mb-2 text-[14px] tracking-tight">⚠️ REGLA SRI - ANULACIÓN OBLIGATORIA</h2>
            <p className="text-[11px] opacity-70 leading-relaxed mb-4">
              Primero debe anular en el portal oficial del SRI. El sistema NO borra para no romper secuencial.<br/><br/>
              Documento: <b className="text-white">{showAnular.secuencial} - {showAnular.receptorNombre}</b><br/>
              Clave: <span className="font-mono text-[9px] opacity-50">{showAnular.claveAcceso.slice(0,30)}...</span>
            </p>
            <a 
              href="https://srienlinea.sri.gob.ec/auth/realms/Internet/protocol/openid-connect/auth?response_type=code&client_id=app-tuportal-internet&redirect_uri=https%3A%2F%2Fsrienlinea.sri.gob.ec%2Ftuportal-internet%2FverificaEmail.jspa&state=b9edb69b-87af-43c7-ae07-cd08b29c6504&login=true&scope=openid"
              target="_blank"
              className="flex items-center justify-between bg-[#00f5d4] text-black px-4 py-3 rounded-xl text-[11px] font-black mb-3 hover:scale-[1.02] transition-all"
            >
              <span>🔗 ABRIR SRI EN LÍNEA - ANULACIÓN</span>
              <span className="bg-black text-[#00f5d4] px-2 py-1 rounded-full text-[8px]">GOB.EC</span>
            </a>
            <div className="flex gap-2">
              <button onClick={()=>setShowAnular(null)} className="flex-1 bg-white/10 py-3 rounded-xl text-xs font-bold">Cancelar</button>
              <button onClick={anularLogico} className="flex-1 bg-red-500 text-white py-3 rounded-xl text-xs font-black hover:bg-red-600">✓ Ya anulé en SRI → ANULADO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}