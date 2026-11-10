"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { etiquetaCobro, marcarPagadoLocal, pasaFiltroCobro } from "@/lib/cobro-etiqueta"

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
  tipo_cobro?: string;
  estado_pago?: string;
  fecha_vencimiento?: string;
  plazo?: number | null;
  cuotas?: number | null;
  facturaId?: string;
}

export default function EmitidosPage(){
  const router = useRouter()
  const empresa = useEmpresa()
  const [docs,setDocs]=useState<ComprobanteHistorialSRI[]>([])
  const [filtro,setFiltro]=useState("")
  const [filtroCobro,setFiltroCobro]=useState("todos")
  const [pagoDoc,setPagoDoc]=useState<ComprobanteHistorialSRI|null>(null)
  const [showAnular,setShowAnular]=useState<ComprobanteHistorialSRI|null>(null)
  const [borradores,setBorradores]=useState<any[]>([])
  const [pendientes,setPendientes]=useState<ComprobanteHistorialSRI[]>([])
  let refrescando = false

  // 1. INYECCION UNIFICADA - Lee todas las llaves
  const cargar = async ()=>{
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
      estadoSRI: d.fechaAutorizacion ? "AUTORIZADO" : (d.estadoSRI || d.estado || "PENDIENTE"),
      xmlContent: d.xmlContent || d.xml || "",
      motivoAnulacion: d.motivoAnulacion,
      fechaAnulacion: d.fechaAnulacion,
      intentos: d.intentos || 0,
      tipo_cobro: d.tipo_cobro || d.tipoCobro || "",
      estado_pago: d.estado_pago || d.estadoPago || "",
      fecha_vencimiento: d.fecha_vencimiento || d.fechaVencimiento || "",
      plazo: d.plazo ?? null,
      cuotas: d.cuotas ?? null,
      facturaId: d.facturaId || ""
    }))

    try {
      const res = await fetch("/api/facturas", { headers: { Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` } })
      if (res.ok) {
        const remotas = await res.json()
        if (Array.isArray(remotas)) unificados.push(...remotas.map((d: any) => ({ ...d, estadoSRI: d.estadoSRI || "EMITIDA" })))
      }
    } catch {}

    const map = new Map()
    unificados.forEach(d=>{ 
      const prev = map.get(d.secuencial)
      if (!prev) map.set(d.secuencial, d)
      else map.set(d.secuencial, { ...prev, ...d, tipo_cobro: d.tipo_cobro || prev.tipo_cobro, estado_pago: d.estado_pago || prev.estado_pago, facturaId: d.facturaId || prev.facturaId, fecha_vencimiento: d.fecha_vencimiento || prev.fecha_vencimiento })
    })
    const todos = Array.from(map.values()).reverse()
    setDocs(todos)
    setPendientes(todos.filter(d=> d.estadoSRI==='PENDIENTE_DE_AUTORIZAR' || d.estadoSRI==='PENDIENTE'))
    setBorradores(get("meijsac_borradores_facturas"))
    const autorizo = await reenviarPendientes(todos)
    if (autorizo && !refrescando) {
      refrescando = true
      await cargar()
      refrescando = false
    }
  }

  const reenviarPendientes = async (lista: ComprobanteHistorialSRI[], avisar = false) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    const marcas = JSON.parse(sessionStorage.getItem("meijsac_sri_reintento") || "{}")
    const ahora = Date.now()
    let autorizo = false
    const candidatos = lista.filter((d) => {
      const clave = String(d.claveAcceso || "").replace(/\D/g, "")
      if (clave.length !== 49 || String((d as { fechaAutorizacion?: string }).fechaAutorizacion || "").trim()) return false
      if (d.estadoSRI === "ANULADO" || d.estadoSRI === "AUTORIZADO") return false
      if (avisar) return true
      return !marcas[clave] || ahora - Number(marcas[clave]) > 60000
    }).slice(0, 5)
    for (const d of candidatos) {
      const clave = String(d.claveAcceso).replace(/\D/g, "")
      marcas[clave] = Date.now()
      sessionStorage.setItem("meijsac_sri_reintento", JSON.stringify(marcas))
      const res = await fetch("/api/facturar/sri", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` },
        body: JSON.stringify({ claveAcceso: clave }),
      }).catch(() => null)
      const data = await res?.json().catch(() => ({}))
      const fecha = String(data?.fechaAutorizacion || "").trim()
      if (avisar) alert(fecha ? `Autorizado ${fecha}` : (data?.mensaje || data?.error || "Sin respuesta del SRI"))
      if (!fecha) continue
      autorizo = true
      const copia = { claveAcceso: clave, estadoSRI: "AUTORIZADO", fechaAutorizacion: fecha, numeroAutorizacion: data.numeroAutorizacion || "", mensajeSri: data.mensaje || "" }
      ;["meijsac_comprobantes_emitidos", "meijsac_documentos_emitidos", "meijsac_facturas", "meijsac_enviados_sri", "meijsac_autorizados", "meijsac_comprobantes_sri", "meijsac_comprobantes_pendientes_sri"].forEach((nombre) => {
        const previa = JSON.parse(localStorage.getItem(nombre) || "[]")
        const items = Array.isArray(previa) ? previa : []
        const i = items.findIndex((x: any) => String(x?.claveAcceso || x?.clave || "").replace(/\D/g, "") === clave)
        if (i >= 0) items[i] = { ...items[i], ...copia }
        else items.push({ ...d, ...copia })
        localStorage.setItem(nombre, JSON.stringify(items))
      })
    }
    return autorizo
  }

  useEffect(()=>{
    cargar()
    window.addEventListener("online", cargar)
    return () => window.removeEventListener("online", cargar)
  },[])

  const reenviarPruebas = async (p: ComprobanteHistorialSRI) => {
    await reenviarPendientes([p], true)
    cargar()
  }

  // 3. BOTONERA DE DESPACHO - GENERICA
  const abrirDocumentoReal = (doc: ComprobanteHistorialSRI, modo: "ride" | "ticket" | "xml") => {
    const clave = String(doc.claveAcceso || "").replace(/\D/g, "")
    if (clave.length !== 49) { alert("Este comprobante no tiene el documento real emitido."); return }
    const url = modo === "ticket" ? `/dashboard/factura-xml/pdf/${clave}?ticket=1` : modo === "xml" ? `/dashboard/factura-xml/pdf/${clave}?xml=1` : `/dashboard/factura-xml/pdf/${clave}`
    if (modo === "xml") { const a = document.createElement("a"); a.href = url; a.click(); return }
    if (!window.open(url, "_blank")) alert("Activa las ventanas emergentes para ver el comprobante.")
  }

  const descargarXML = (doc: ComprobanteHistorialSRI) => abrirDocumentoReal(doc, "xml")

  const descargarPDF = (doc: ComprobanteHistorialSRI) => abrirDocumentoReal(doc, "ride")

  const descargarTicket = (doc: ComprobanteHistorialSRI) => {
    if (doc.tipoComprobante === "07" || doc.tipoComprobante === "06") { alert(`Documentos tipo ${doc.tipoComprobante} por normativa SRI solo se permiten en formato RIDE A4`); return }
    abrirDocumentoReal(doc, "ticket")
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

  const filtrados = useMemo(()=>docs.filter(d=> (d.secuencial.includes(filtro) || d.receptorNombre.toLowerCase().includes(filtro.toLowerCase())) && pasaFiltroCobro(d, filtroCobro)),[docs,filtro,filtroCobro])
  const registrarPago = async (doc: ComprobanteHistorialSRI) => {
    marcarPagadoLocal(doc)
    if (doc.facturaId) {
      await fetch("/api/facturas", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` }, body: JSON.stringify({ id: doc.facturaId }) })
    }
    setPagoDoc(null)
    cargar()
  }

  return (
    <div className="min-h-screen bg-[#060608] text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <Chismoso texto="Regresa al hub principal de comprobantes"><button onClick={()=>router.push("/dashboard/comprobantes")} className="bg-white text-black px-4 py-2 rounded-xl text-xs font-bold">← Volver a COMPROBANTES</button></Chismoso>
        <Chismoso texto="Historial maestro unificado para cualquier actividad económica"><h1 className="font-black tracking-tight">COMPROBANTES EMITIDOS - {docs.length} DOCS - {empresa.nombreComercial}</h1></Chismoso>
        <Chismoso texto="Filtra por secuencial o por cliente/proveedor"><input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar secuencial / cliente" className="bg-black border border-white/10 rounded-xl px-4 py-2 text-xs w-[240px]" /></Chismoso>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[["todos","Todos"],["pagado","Contado"],["pendiente","Pendientes de Pago"],["credito","Crédito"]].map(([id,label]) => (
          <button key={id} onClick={()=>setFiltroCobro(id)} className={`px-3 py-1 rounded-full text-[10px] font-black ${filtroCobro===id?"bg-[#00f5d4] text-black":"bg-white/10"}`}>{label}</button>
        ))}
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
            <h2 className="font-black text-[12px] text-yellow-400 tracking-widest">PENDIENTES DE AUTORIZAR - {pendientes.length}</h2>
            <span className="text-[9px] bg-yellow-400 text-black px-2 py-1 rounded-full font-black">ENVIAR A SRI PRUEBAS</span>
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
                  <Chismoso texto="Enviar este XML firmado al SRI de pruebas"><button onClick={() => reenviarPruebas(p)} className="bg-white text-black px-2 py-1 rounded-lg text-[10px] font-bold">ENVIAR</button></Chismoso>
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
          <div className="col-span-2"><Chismoso texto="Cliente o proveedor según tipo" pos="bottom">RECEPTOR ⓘ</Chismoso></div>
          <div className="col-span-1"><Chismoso texto="Si está ANULADO pasa a $0.00" pos="bottom">TOTAL ⓘ</Chismoso></div>
          <div className="col-span-1"><Chismoso texto="AUTORIZADO, PENDIENTE, ANULADO" pos="bottom">ESTADO ⓘ</Chismoso></div>
          <div className="col-span-2">TIPO DE COBRO</div>
          <div className="col-span-2">ESTADO DE PAGO</div>
          <div className="col-span-1 text-right"><Chismoso texto="Descargas SRI válidas" pos="bottom">ACCIONES ⓘ</Chismoso></div>
        </div>
        {filtrados.map((d,i)=>(
          <div key={i} className={`grid grid-cols-12 p-3 border-t border-white/5 text-[11px] items-center hover:bg-white/[0.03] ${d.estadoSRI==='ANULADO'?'opacity-40 grayscale':''}`}>
            <div className="col-span-1"><Chismoso texto={`${d.tipoComprobante} - ${d.tipoComprobante==='07'?'Retención':'Factura'}`}><span className={`px-2 py-1 rounded-full text-[9px] font-black ${d.tipoComprobante==='07'?'bg-orange-500/20 text-orange-400 border border-orange-500/30': d.estadoSRI==='ANULADO'?'bg-red-500/20 text-red-400' : d.estadoSRI.includes('PENDIENTE')?'bg-yellow-500/20 text-yellow-400' : 'bg-[#ffbe0a]/20 text-[#ffbe0a]'}`}>{d.tipoComprobante} - {d.tipoComprobante==='07'?'RET':d.tipoComprobante==='01'?'FAC':'DOC'}</span></Chismoso></div>
            <div className="col-span-2"><Chismoso texto={`Clave: ${d.claveAcceso}`}><span className="font-mono font-bold text-[#ffbe0a]">{d.secuencial}</span></Chismoso></div>
            <div className="col-span-2 truncate"><Chismoso texto={`RUC: ${d.receptorIdentificacion}`}><span>{d.receptorNombre} <span className="opacity-30">{d.receptorIdentificacion.slice(0,10)}</span></span></Chismoso></div>
            <div className="col-span-1"><span className="font-black">${d.estadoSRI==='ANULADO'?'0.00':d.valorTotal.toFixed(2)}</span></div>
            <div className="col-span-1"><span className={`px-2 py-1 rounded-full text-[9px] font-black ${d.estadoSRI==='AUTORIZADO'?'bg-emerald-500/20 text-emerald-400': d.estadoSRI==='ANULADO'?'bg-zinc-700 text-zinc-400':'bg-yellow-500/20 text-yellow-400'}`}>{d.estadoSRI==='ANULADO'?'🚫 ANULADO': d.estadoSRI.includes('PENDIENTE')?'⏳ PENDIENTE':`✓ ${d.estadoSRI}`}</span></div>
            <div className="col-span-2"><span className="text-[10px]">{d.tipo_cobro || "EFECTIVO"}</span></div>
            <div className="col-span-2">{(() => { const e = etiquetaCobro(d); if (!e.texto) return null; return <button onClick={() => { if (e.clave !== "pagado") setPagoDoc(d) }} className={`px-2 py-1 rounded-full text-[9px] font-black ${e.clase}`}>{e.texto}</button> })()}</div>
            <div className="col-span-1 flex justify-end gap-1 flex-wrap">
              <Chismoso texto="RIDE A4 oficial"><button onClick={()=>descargarPDF(d)} className="bg-white text-black px-2 py-1 rounded-lg text-[10px] font-bold hover:scale-105">📄 PDF</button></Chismoso>
              <Chismoso texto="Ticket 80mm - solo 01,04,05"><button onClick={()=>descargarTicket(d)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${d.tipoComprobante==='01' || d.tipoComprobante==='04' || d.tipoComprobante==='05'?'bg-[#00f5d4] text-black hover:scale-105':'bg-white/10 text-white/20 cursor-not-allowed'}`}>🧾 TICK</button></Chismoso>
              <Chismoso texto="XML con autorización"><button onClick={()=>descargarXML(d)} className="bg-[#3a86ff] text-white px-2 py-1 rounded-lg text-[10px] font-bold hover:scale-105">📁 XML</button></Chismoso>
              <button onClick={()=>setShowAnular(d)} className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg text-[10px] font-black hover:bg-red-500 hover:text-white">🚫</button>
            </div>
          </div>
        ))}
      </div>

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