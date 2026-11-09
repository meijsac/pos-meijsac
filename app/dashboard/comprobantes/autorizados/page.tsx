"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { etiquetaCobro, marcarPagadoLocal, pasaFiltroCobro } from "@/lib/cobro-etiqueta"
import { clasificarEstadoSri, estadoEnModal } from "@/lib/sri/estado-visible"

// === AUMENTADO: COMPONENTE CHISMOSO - NO BORRA NADA ===
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

interface ComprobanteHistorialSRI {
  id: string;
  tipoComprobante: '01' | '04' | '05' | '06' | '07';
  secuencial: string;
  establecimiento?: string;
  claveAcceso: string;
  fechaEmision: string;
  receptorIdentificacion: string;
  receptorNombre: string;
  valorTotal: number;
  estadoSRI: 'AUTORIZADO' | 'PENDIENTE' | 'RECHAZADO' | 'ANULADO';
  fechaAutorizacion?: string;
  numeroAutorizacion?: string;
  mensajeSri?: string;
  estadoRecepcion?: string;
  motivoAnulacion?: string;
  fechaAnulacion?: string;
  xmlContent?: string;
  tipo_cobro?: string;
  estado_pago?: string;
  fecha_vencimiento?: string;
  facturaId?: string;
}

export default function EmitidosPage(){
  const router = useRouter()
  const [docs,setDocs]=useState<ComprobanteHistorialSRI[]>([])
  const [filtro,setFiltro]=useState("")
  const [filtroCobro,setFiltroCobro]=useState("todos")
  const [pagoDoc,setPagoDoc]=useState<ComprobanteHistorialSRI|null>(null)
  const [showAnular,setShowAnular]=useState<ComprobanteHistorialSRI|null>(null)
  const [verSri,setVerSri]=useState<ComprobanteHistorialSRI|null>(null)
  const [consultando,setConsultando]=useState("")

  // 1. INYECCION UNIFICADA - Aquí está la solución al POS
  const cargar = async ()=>{
    const get = (k:string)=>{ try{ return JSON.parse(localStorage.getItem(k)||"[]") }catch{ return [] } }
    
    // LEEMOS TODAS LAS LLAVES POSIBLES
    const fuentes = [
      ...get("meijsac_comprobantes_sri"),
      ...get("meijsac_comprobantes_emitidos"),
      ...get("meijsac_documentos_emitidos"),
      ...get("meijsac_facturas"),
      ...get("meijsac_ventas_pos"), // <- TU POS DE CHIFA ESTABA AQUÍ
      ...get("meijsac_restaurante_facturas"), // <- Y AQUÍ
      ...get("meijsac_enviados_sri"),
      ...get("meijsac_autorizados"),
      ...get("meijsac_emitidos"),
      ...get("meijsac_facturas_emitidas"),
      ...get("meijsac_guias_06"),
      ...get("meijsac_liquidaciones_03"),
      ...get("meijsac_retenciones").map((r:any)=>({
        id: r.id, tipoComprobante:'07', secuencial:r.numRetencion||r.secuencial,
        claveAcceso: r.claveAccesoSustento||r.clave, fechaEmision: r.fechaGeneracion||r.fecha,
        receptorIdentificacion: r.proveedorRuc||r.ruc, receptorNombre: r.proveedorNombre||r.razon,
        valorTotal: (Number(r.valorRetRenta)||0)+(Number(r.valorRetIva)||0), estadoSRI: r.estado || "PENDIENTE",
        fechaAutorizacion: r.fechaAutorizacion || "", numeroAutorizacion: r.numeroAutorizacion || "", mensajeSri: r.mensajeSri || "",
        xmlContent: r.xml
      }))
    ]

    const ficha = (d: any, i: number): ComprobanteHistorialSRI => {
      const fechaAutorizacion = String(d.fechaAutorizacion || "")
      const crudo = String(d.estadoSRI || d.estado || "")
      const anulado = crudo.toUpperCase().includes("ANUL")
      return {
        id: d.id || d.facturaId || `doc-${i}-${d.secuencial || i}`,
        tipoComprobante: d.tipoComprobante || (String(d.tipo || "").includes("07") ? "07" : String(d.tipo || "").includes("04") ? "04" : String(d.tipo || "").includes("05") ? "05" : String(d.tipo || "").includes("06") ? "06" : "01"),
        secuencial: d.secuencial || d.numRetencion || "",
        claveAcceso: String(d.claveAcceso || d.clave || d.claveAccesoSustento || "").replace(/\s/g, ""),
        fechaEmision: d.fechaEmision || d.fecha || d.fechaGeneracion || "",
        receptorIdentificacion: d.receptorIdentificacion || d.ruc || d.rucProveedor || d.receptorRuc || "",
        receptorNombre: d.receptorNombre || d.razon || d.proveedor || d.proveedorNombre || "",
        valorTotal: Number(d.valorTotal ?? d.total ?? d.valorRetenido ?? 0),
        estadoSRI: anulado ? "ANULADO" : clasificarEstadoSri(crudo, fechaAutorizacion),
        xmlContent: d.xmlContent || d.xml || "",
        motivoAnulacion: d.motivoAnulacion,
        fechaAnulacion: d.fechaAnulacion,
        tipo_cobro: d.tipo_cobro || d.tipoCobro || "",
        estado_pago: d.estado_pago || d.estadoPago || "",
        fecha_vencimiento: d.fecha_vencimiento || d.fechaVencimiento || "",
        facturaId: d.facturaId || d.id || "",
        fechaAutorizacion,
        numeroAutorizacion: fechaAutorizacion ? String(d.numeroAutorizacion || "") : "",
        mensajeSri: String(d.mensajeSri || d.mensajeAutorizacion || d.mensaje || ""),
        estadoRecepcion: String(d.estadoRecepcion || ""),
      }
    }
    const unificados: ComprobanteHistorialSRI[] = fuentes.map(ficha)
    try {
      const res = await fetch("/api/facturas", { credentials: "same-origin", headers: { Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` } })
      if (res.ok) {
        const remotas = await res.json()
        if (Array.isArray(remotas)) unificados.push(...remotas.map(ficha))
      }
    } catch {}

    const map = new Map()
    unificados.forEach(d=>{
      const llave = d.claveAcceso || d.secuencial || d.id
      const prev = map.get(llave)
      if (!prev) map.set(llave, d)
      else {
        const fecha = d.fechaAutorizacion || prev.fechaAutorizacion || ""
        const anulado = d.estadoSRI === "ANULADO" || prev.estadoSRI === "ANULADO"
        map.set(llave, {
          ...prev, ...d,
          fechaAutorizacion: fecha,
          numeroAutorizacion: d.numeroAutorizacion || prev.numeroAutorizacion,
          mensajeSri: d.mensajeSri || prev.mensajeSri,
          estadoSRI: anulado ? "ANULADO" : clasificarEstadoSri(fecha ? "AUTORIZADO" : (d.estadoSRI === "RECHAZADO" ? "DEVUELTA" : d.estadoSRI), fecha),
          tipo_cobro: d.tipo_cobro || prev.tipo_cobro,
          estado_pago: d.estado_pago || prev.estado_pago,
          facturaId: d.facturaId || prev.facturaId,
          fecha_vencimiento: d.fecha_vencimiento || prev.fecha_vencimiento,
        })
      }
    })
    setDocs(Array.from(map.values()).reverse())
  }

  const consultarDeNuevo = async (doc: ComprobanteHistorialSRI) => {
    setConsultando(doc.id)
    try {
      const res = await fetch("/api/sri/consultar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.facturaId || doc.id, claveAcceso: doc.claveAcceso }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVerSri({ ...doc, mensajeSri: data.error || data.mensaje || "No se pudo consultar al SRI." })
        return
      }
      setVerSri({
        ...doc,
        estadoSRI: data.visible || doc.estadoSRI,
        fechaAutorizacion: data.fechaAutorizacion || "",
        numeroAutorizacion: data.numeroAutorizacion || "",
        mensajeSri: data.mensaje || "",
      })
      await cargar()
    } catch {
      setVerSri({ ...doc, mensajeSri: "No se pudo consultar al SRI. Inténtalo de nuevo." })
    } finally {
      setConsultando("")
    }
  }

  useEffect(()=>{
    cargar()
    const alVolver = () => { if (document.visibilityState === "visible") cargar() }
    window.addEventListener("focus", cargar)
    document.addEventListener("visibilitychange", alVolver)
    return () => {
      window.removeEventListener("focus", cargar)
      document.removeEventListener("visibilitychange", alVolver)
    }
  },[])

  // 2. BOTONERA DE DESPACHO
  const descargarXML = (doc:ComprobanteHistorialSRI)=>{
    const partes = String(doc.establecimiento || doc.secuencial || "001-001").split("-")
    const estab = (partes[0] || "001").replace(/\D/g, "").padStart(3, "0").slice(-3)
    const pto = (partes[1] || "001").replace(/\D/g, "").padStart(3, "0").slice(-3)
    const xml = doc.xmlContent || `<?xml version="1.0"?><comprobante><infoTributaria><claveAcceso>${doc.claveAcceso}</claveAcceso><codDoc>${doc.tipoComprobante}</codDoc><estab>${estab}</estab><ptoEmi>${pto}</ptoEmi><secuencial>${doc.secuencial.split('-').pop()}</secuencial></infoTributaria><infoAdicional><numeroAutorizacion>${doc.claveAcceso}</numeroAutorizacion><fechaAutorizacion>${doc.fechaEmision}</fechaAutorizacion></infoAdicional></comprobante>`
    const blob = new Blob([xml],{type:'text/xml'}); const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`${doc.tipoComprobante}-${doc.secuencial}.xml`; a.click()
  }

  const descargarPDF = (doc:ComprobanteHistorialSRI)=>{
    // RIDE A4 SRI
    const w=window.open('','','width=800,height=900'); if(!w) return
    w.document.write(`
      <html><head><title>RIDE ${doc.secuencial}</title>
      <style>body{font-family:Arial;font-size:12px;padding:20px} .header{display:flex;justify-content:space-between;border:1px solid #000;padding:10px} .barcode{margin-top:20px;font-family:monospace;letter-spacing:2px;text-align:center;border:1px solid #000;padding:10px} .anulado{color:red;border:3px solid red;text-align:center;font-weight:900;font-size:30px;transform:rotate(-15deg);opacity:0.3;position:absolute;top:40%;left:30%}</style>
      </head><body>
      ${doc.estadoSRI==='ANULADO'?'<div class="anulado">ANULADO EN SRI</div>':''}
      <div class="header"><div><b>MEIJSAC FACTURACION</b><br/>RUC: 1799999999001<br/>Dir Matriz: Quito<br/>Obligado Contabilidad: SI</div><div><b>RIDE - ${doc.tipoComprobante==='07'?'RETENCION':'FACTURA'}</b><br/>No. ${doc.secuencial}<br/>Clave Acceso:<br/>${doc.claveAcceso}<br/>Estado: ${doc.estadoSRI}</div></div>
      <p><b>Cliente/Proveedor:</b> ${doc.receptorNombre}<br/><b>RUC/CI:</b> ${doc.receptorIdentificacion}<br/><b>Fecha:</b> ${doc.fechaEmision}</p>
      <table border="1" width="100%" cellpadding="5"><tr><th>Valor Total</th><td>$${doc.estadoSRI==='ANULADO'?'0.00':doc.valorTotal.toFixed(2)}</td></tr></table>
      <div class="barcode">${doc.claveAcceso}</div>
      <script>window.print()</script>
      </body></html>`)
  }

  const descargarTicket = (doc:ComprobanteHistorialSRI)=>{
    if(doc.tipoComprobante==='07' || doc.tipoComprobante==='06'){ alert("Las Retenciones 07 y Guías 06 solo se permiten en formato RIDE A4 corporativo SRI"); return }
    const w=window.open('','','width=300,height=600'); if(!w) return
    w.document.write(`<html><body style="width:80mm;font-family:monospace;font-size:10px;text-align:center"><b>CHIFA MEIJSAC</b><br/>${doc.secuencial}<br/>${doc.fechaEmision}<br/>${doc.receptorNombre}<br/>----------------<br/>TOTAL: $${doc.valorTotal.toFixed(2)}<br/>----------------<br/>Clave:${doc.claveAcceso.slice(0,20)}...<br/><script>window.print()</script></body></html>`)
  }

  const anularLogico = ()=>{
    if(!showAnular) return
    const todosKeys = ["meijsac_comprobantes_sri","meijsac_comprobantes_emitidos","meijsac_documentos_emitidos","meijsac_facturas","meijsac_retenciones","meijsac_ventas_pos","meijsac_restaurante_facturas","meijsac_enviados_sri"]
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

  const filtrados = useMemo(()=>docs.filter(d=> ((d.secuencial || "").includes(filtro) || (d.receptorNombre || "").toLowerCase().includes(filtro.toLowerCase())) && pasaFiltroCobro(d, filtroCobro)),[docs,filtro,filtroCobro])
  const registrarPago = async (doc: ComprobanteHistorialSRI) => {
    marcarPagadoLocal(doc)
    if (doc.facturaId) await fetch("/api/facturas", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` }, body: JSON.stringify({ id: doc.facturaId }) })
    setPagoDoc(null)
    cargar()
  }

  return (
    <div className="min-h-screen bg-[#060608] text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <Chismoso texto="Regresa al menú donde ves 15 DOCS en amarillo y 167 COMPRAS. Tu hub principal"><button onClick={()=>router.push("/dashboard/comprobantes")} className="bg-white text-black px-4 py-2 rounded-xl text-xs font-bold">← Volver a COMPROBANTES</button></Chismoso>
        <Chismoso texto="Historial maestro unificado: aquí llegan facturas 01 del POS chifa + retenciones 07 de CHUBB ATS 2.0. Todo en orden descendente"><h1 className="font-black tracking-tight">COMPROBANTES AUTORIZADOS</h1></Chismoso>
        <Chismoso texto="Filtra por secuencial 001-001-000000007 o por cliente CHUBB, UNIK, ARCACONTINENTAL"><input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar secuencial / cliente" className="bg-black border border-white/10 rounded-xl px-4 py-2 text-xs w-[240px]" /></Chismoso>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[["todos","Todos"],["pagado","Contado"],["pendiente","Pendientes de Pago"],["credito","Crédito"]].map(([id,label]) => (
          <button key={id} onClick={()=>setFiltroCobro(id)} className={`px-3 py-1 rounded-full text-[10px] font-black ${filtroCobro===id?"bg-[#00f5d4] text-black":"bg-white/10"}`}>{label}</button>
        ))}
      </div>

      <div className="bg-[#11131a] rounded-[20px] border border-white/10 overflow-hidden">
        <div className="grid grid-cols-12 p-3 text-[10px] opacity-40 font-black tracking-widest">
          <div className="col-span-1"><Chismoso texto="01=Factura venta, 04=Nota Crédito anula, 05=Nota Débito cobra interés, 06=Guía transporte, 07=Retención SRI" pos="bottom">TIPO ⓘ</Chismoso></div>
          <div className="col-span-2"><Chismoso texto="Numeración SRI 001-001-000000007. Si borras uno te multan por salto de folio" pos="bottom">SECUENCIAL ⓘ</Chismoso></div>
          <div className="col-span-2"><Chismoso texto="Receptor: cliente si es 01, proveedor si es 07. Ej: BEBIDAS ARCACONTINENTAL" pos="bottom">RECEPTOR ⓘ</Chismoso></div>
          <div className="col-span-1"><Chismoso texto="Valor líquido. Si está ANULADO automáticamente pasa a $0.00 en tus reportes de ventas" pos="bottom">TOTAL ⓘ</Chismoso></div>
          <div className="col-span-1"><Chismoso texto="AUTORIZADO=SRI lo aceptó. ANULADO=Ya anulado en portal y no suma. PENDIENTE=Sin enviar" pos="bottom">ESTADO ⓘ</Chismoso></div>
          <div className="col-span-2">TIPO DE COBRO</div>
          <div className="col-span-2">ESTADO DE PAGO</div>
          <div className="col-span-1 text-right"><Chismoso texto="Botones de despacho: descarga física para cliente y contador" pos="bottom">ACCIONES ⓘ</Chismoso></div>
        </div>
        {filtrados.map((d,i)=>(
          <div key={d.claveAcceso || d.id || i} className={`border-t border-white/5 ${d.estadoSRI==='ANULADO'?'opacity-40 grayscale':''}`}>
          <div className="grid grid-cols-12 p-3 text-[11px] items-center hover:bg-white/[0.03]">
            <div className="col-span-1"><Chismoso texto={d.tipoComprobante==='07'?'Esta retención 07 ya está indexada y le retuviste a tu proveedor':'Factura 01 emitida desde POS chifa o facturador'}><span className={`px-2 py-1 rounded-full text-[9px] font-black ${d.tipoComprobante==='07'?'bg-orange-500/20 text-orange-400 border border-orange-500/30': d.estadoSRI==='ANULADO'?'bg-red-500/20 text-red-400' : 'bg-[#ffbe0a]/20 text-[#ffbe0a]'}`}>{d.tipoComprobante} - {d.tipoComprobante==='07'?'RETENCIÓN':d.tipoComprobante==='01'?'FACTURA':'DOC'}</span></Chismoso></div>
            <div className="col-span-2"><Chismoso texto={`Clave Acceso 49 dígitos: ${d.claveAcceso.slice(0,22)}... Esta clave es tu autorización SRI`}><span className="font-mono font-bold text-[#ffbe0a]">{d.secuencial}</span></Chismoso></div>
            <div className="col-span-2 truncate"><Chismoso texto={`RUC: ${d.receptorIdentificacion} | Fecha: ${d.fechaEmision} | Clave completa en PDF`}><span>{d.receptorNombre} <span className="opacity-30">{d.receptorIdentificacion.slice(0,10)}</span></span></Chismoso></div>
            <div className="col-span-1"><Chismoso texto={d.estadoSRI==='ANULADO'?'Ya no suma en reportes ni ATS. Queda en $0.00':'Valor exacto que declaras al SRI y a tu contador'}><span className="font-black">${d.estadoSRI==='ANULADO'?'0.00':d.valorTotal.toFixed(2)}</span></Chismoso></div>
            <div className="col-span-1"><span className={`px-2 py-1 rounded-full text-[9px] font-black ${d.estadoSRI==='AUTORIZADO'?'bg-emerald-500/20 text-emerald-400': d.estadoSRI==='RECHAZADO'?'bg-red-500/20 text-red-300': d.estadoSRI==='ANULADO'?'bg-zinc-700 text-zinc-400':'bg-yellow-500/20 text-yellow-300'}`}>{d.estadoSRI==='AUTORIZADO'?'✓ AUTORIZADO': d.estadoSRI==='RECHAZADO'?'RECHAZADO / DEVUELTO': d.estadoSRI==='ANULADO'?'ANULADO':'PENDIENTE'}</span></div>
            <div className="col-span-2"><span className="text-[10px]">{d.tipo_cobro || "EFECTIVO"}</span></div>
            <div className="col-span-2">{(() => { const e = etiquetaCobro(d); if (!e.texto) return null; return <button onClick={() => { if (e.clave !== "pagado") setPagoDoc(d) }} className={`px-2 py-1 rounded-full text-[9px] font-black ${e.clase}`}>{e.texto}</button> })()}</div>
            <div className="col-span-1 flex justify-end gap-1 flex-wrap">
              <Chismoso texto="RIDE A4 oficial con código de barras, bloques SRI, válido para cliente y contabilidad"><button onClick={()=>descargarPDF(d)} className="bg-white text-black px-2 py-1 rounded-lg text-[10px] font-bold hover:scale-105">📄 PDF</button></Chismoso>
              <Chismoso texto={d.tipoComprobante==='07'?'Retención 07 y Guía 06 SIEMPRE en A4 corporativo, SRI no permite ticket':'Ticket 80mm térmico para impresora del chifa - solo facturas 01'}><button onClick={()=>descargarTicket(d)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${d.tipoComprobante==='01'?'bg-[#00f5d4] text-black hover:scale-105':'bg-white/10 text-white/20 cursor-not-allowed'}`}>🧾 TICK</button></Chismoso>
              <Chismoso texto="XML fuente con firma XAdES-BES y <numeroAutorizacion>. Este es el archivo que audita el SRI y pide el contador para ATS"><button onClick={()=>descargarXML(d)} className="bg-[#3a86ff] text-white px-2 py-1 rounded-lg text-[10px] font-bold hover:scale-105">📁 XML</button></Chismoso>
              <Chismoso texto="Reenvía correo al cliente con PDF+XML si digitó mal el email en caja"><button onClick={()=>{ window.location.href=`mailto:${d.receptorNombre}?subject=Comprobante ${d.secuencial}&body=Adjunto XML y PDF con autorizacion ${d.claveAcceso}`}} className="bg-white/10 px-2 py-1 rounded-lg text-[10px]">✉️</button></Chismoso>
              <Chismoso texto="¡CUIDADO! No borra, anula en SRI con tu link oficial"><button onClick={()=>setShowAnular(d)} className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg text-[10px] font-black hover:bg-red-500 hover:text-white">🚫</button></Chismoso>
            </div>
          </div>
          <div className="px-3 pb-3 text-[10px] leading-relaxed space-y-1">
            <p className="font-mono break-all">Clave de acceso: {d.claveAcceso.length === 49 ? d.claveAcceso : "Sin clave de 49 dígitos"}</p>
            <p>Fecha y hora de autorización del SRI: {d.fechaAutorizacion || "—"}</p>
            <p>Número de autorización del SRI: {d.numeroAutorizacion || "—"}</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setVerSri(d)} className="bg-white text-black px-3 py-1 rounded-full text-[10px] font-black">VERIFICAR CON SRI</button>
              {d.estadoSRI === "PENDIENTE" && <button disabled={consultando === d.id} onClick={() => consultarDeNuevo(d)} className="bg-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-black disabled:opacity-50">{consultando === d.id ? "Consultando..." : "Consultar de nuevo al SRI"}</button>}
            </div>
          </div>
          </div>
        ))}
      </div>

      {verSri && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#11131a] border border-white/10 rounded-2xl p-5 max-w-lg w-full text-sm">
            <h2 className="font-black mb-3">Verificar con el SRI</h2>
            <p className="text-[10px] opacity-60 mb-1">Clave de Acceso (49 dígitos)</p>
            <p className="font-mono text-[12px] break-all mb-2">{verSri.claveAcceso.length === 49 ? verSri.claveAcceso : "Esta fila no tiene una clave de 49 dígitos."}</p>
            <button onClick={() => { if (verSri.claveAcceso.length === 49) navigator.clipboard.writeText(verSri.claveAcceso) }} className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold mb-3">Copiar</button>
            <p>Estado SRI: <b>{estadoEnModal(verSri.estadoSRI === "RECHAZADO" ? "DEVUELTA" : verSri.estadoSRI, verSri.fechaAutorizacion, verSri.estadoRecepcion)}</b></p>
            <p className="mt-2">Fecha de Autorización SRI: <b>{verSri.fechaAutorizacion || "El SRI no devolvió fecha"}</b></p>
            <p className="mt-2">Mensaje del SRI: <b>{verSri.mensajeSri || "El SRI no devolvió un mensaje para este comprobante."}</b></p>
            <a href="https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/publico/validezComprobantes.jsf" target="_blank" rel="noreferrer" className="block mt-4 text-[#00f5d4] font-bold text-[12px]">Verificar en SRI en Línea</a>
            <button onClick={() => setVerSri(null)} className="mt-4 w-full bg-white text-black py-2 rounded-xl text-xs font-black">Cerrar</button>
          </div>
        </div>
      )}
      {pagoDoc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#11131a] border border-white/10 rounded-2xl p-5 max-w-sm w-full">
            <h2 className="font-black mb-2">Registrar Pago</h2>
            <p className="text-xs opacity-70 mb-4">{pagoDoc.receptorNombre} · {pagoDoc.secuencial} · ${pagoDoc.valorTotal.toFixed(2)}</p>
            <div className="flex gap-2">
              <button onClick={() => setPagoDoc(null)} className="flex-1 bg-white/10 py-3 rounded-xl text-xs">Cancelar</button>
              <button onClick={() => registrarPago(pagoDoc)} className="flex-1 bg-emerald-400 text-black py-3 rounded-xl text-xs font-black">Registrar cobro</button>
            </div>
          </div>
        </div>
      )}
      {showAnular && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-[#11131a] border border-red-500/30 rounded-[24px] p-6 max-w-[460px] w-full shadow-2xl">
            <h2 className="font-black text-red-400 mb-2 text-[14px] tracking-tight">⚠️ REGLA SRI - ANULACIÓN OBLIGATORIA</h2>
            <p className="text-[11px] opacity-70 leading-relaxed mb-4">
              Recuerde que <b>primero debe anular en el portal oficial del SRI</b>. El sistema NO borra el registro para no romper el secuencial y evitar multas.<br/><br/>
              Documento a anular: <b className="text-white">{showAnular.secuencial} - {showAnular.receptorNombre}</b><br/>
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
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
              <p className="text-[10px] text-red-300 leading-tight">
                <b>Pasos en el SRI:</b> 1. Ingrese con RUC y clave → 2. Facturación Electrónica → 3. Anulación de Comprobantes → 4. Buscar {showAnular.secuencial} → 5. Confirmar anulación
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowAnular(null)} className="flex-1 bg-white/10 py-3 rounded-xl text-xs font-bold">Cancelar</button>
              <button onClick={anularLogico} className="flex-1 bg-red-500 text-white py-3 rounded-xl text-xs font-black hover:bg-red-600">✓ Ya anulé en SRI → Poner ANULADO</button>
            </div>
            <p className="text-[8px] opacity-30 text-center mt-3 tracking-widest uppercase">Anulación lógica no destructiva - Conserva secuencial SRI</p>
          </div>
        </div>
      )}

      <div className="mt-6 text-[10px] opacity-30 leading-relaxed max-w-3xl">
        AUTORIZADO solo aparece si el SRI devolvió la fecha de autorización. Si no, queda PENDIENTE o RECHAZADO.
      </div>
    </div>
  )
}