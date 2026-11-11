"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { etiquetaCobro, marcarPagadoLocal, pasaFiltroCobro } from "@/lib/cobro-etiqueta"
import { esDelAmbiente } from "@/lib/ambiente-datos"
import { useAmbienteVivo } from "@/components/SelloAmbiente"

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
  const ambiente = useAmbienteVivo()
  const ambienteRef = useRef(ambiente)
  ambienteRef.current = ambiente
  const [docs,setDocs]=useState<ComprobanteHistorialSRI[]>([])
  const [filtro,setFiltro]=useState("")
  const [filtroCobro,setFiltroCobro]=useState("todos")
  const [pagoDoc,setPagoDoc]=useState<ComprobanteHistorialSRI|null>(null)
  const [showAnular,setShowAnular]=useState<ComprobanteHistorialSRI|null>(null)
  const [claveAnular,setClaveAnular]=useState("")
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
      tipoComprobante: d.tipoComprobante || d.codDoc || (d.tipo?.includes('07')?'07':d.tipo?.includes('06')?'06':d.tipo?.includes('05')?'05':d.tipo?.includes('04')?'04':d.tipo?.includes('03')?'03':'01'),
      secuencial: d.secuencial || d.numRetencion || `001-001-00000${i}`,
      claveAcceso: d.claveAcceso || d.clave || d.claveAccesoSustento || `000000000000000000000000${i}`,
      fechaEmision: d.fechaEmision || d.fecha || d.fechaGeneracion || new Date().toLocaleDateString('es-EC'),
      fechaAutorizacion: d.fechaAutorizacion || "",
      fechaISO: d.fechaISO || d.fechaCreacion || new Date().toISOString(),
      receptorIdentificacion: d.receptorIdentificacion || d.ruc || d.rucProveedor || d.receptorRuc || "9999999999999",
      receptorNombre: d.receptorNombre || d.razon || d.proveedor || d.proveedorNombre || "CONSUMIDOR FINAL",
      valorTotal: Number(d.valorTotal ?? d.total ?? d.valorRetenido ?? 0),
      estadoSRI: String(d.estadoSRI || d.estado || "").toUpperCase().includes("ANUL") ? "ANULADO" : (d.fechaAutorizacion ? "AUTORIZADO" : (d.estadoSRI || d.estado || "PENDIENTE")),
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
    unificados.filter((d) => esDelAmbiente(d, ambienteRef.current)).forEach(d=>{ 
      const clave = String(d.claveAcceso || "").replace(/\D/g, "")
      const llave = clave.length === 49 ? clave : d.secuencial
      const prev = map.get(llave)
      if (!prev) map.set(llave, d)
      else {
        const anulado = prev.estadoSRI === "ANULADO" || d.estadoSRI === "ANULADO"
        map.set(llave, { ...prev, ...d, estadoSRI: anulado ? "ANULADO" : (d.estadoSRI || prev.estadoSRI), tipo_cobro: d.tipo_cobro || prev.tipo_cobro, estado_pago: d.estado_pago || prev.estado_pago, facturaId: d.facturaId || prev.facturaId, fecha_vencimiento: d.fecha_vencimiento || prev.fecha_vencimiento, fechaEmision: d.fechaEmision || prev.fechaEmision })
      }
    })
    const todos = Array.from(map.values()).reverse()
    setDocs(todos)
    setPendientes(todos.filter(d=> d.estadoSRI==='PENDIENTE_DE_AUTORIZAR' || d.estadoSRI==='PENDIENTE'))
    setBorradores(get("meijsac_borradores_facturas").filter((d: unknown) => esDelAmbiente(d, ambienteRef.current)))
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
    if (ambiente !== "1" && ambiente !== "2") return
    cargar()
    window.addEventListener("online", cargar)
    return () => window.removeEventListener("online", cargar)
  },[ambiente])

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
  const verImprimir = (doc: ComprobanteHistorialSRI) => {
    const clave = String(doc.claveAcceso || "").replace(/\D/g, "")
    if (clave.length !== 49) { alert("Este comprobante no tiene el documento real emitido."); return }
    router.push(`/dashboard/factura-xml/visor/${clave}?ver=1`)
  }
  const nombreTipo = (codigo: string) => ({ "01": "Factura", "03": "Liq. compra", "04": "Nota crédito", "05": "Nota débito", "06": "Guía", "07": "Retención" }[codigo] || "Factura")
  const insigniaPago = (d: ComprobanteHistorialSRI) => {
    const e = etiquetaCobro(d)
    if (e.clave === "credito") return { texto: "Crédito", clase: "bg-violet-500/10 text-violet-200 border border-violet-500/30" }
    if (e.clave === "pendiente") return { texto: "Pendiente", clase: "bg-amber-500/10 text-amber-200 border border-amber-500/30" }
    return { texto: "Pagado", clase: "bg-teal-500/10 text-teal-300 border border-teal-500/30" }
  }

  const anularLogico = async ()=>{
    if(!showAnular) return
    const conf = await fetch("/api/auth/confirmar-clave", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: claveAnular }) })
    if (!conf.ok) { alert("Confirma tu contraseña para anular"); return }
    const todosKeys = ["meijsac_comprobantes_sri","meijsac_comprobantes_emitidos","meijsac_documentos_emitidos","meijsac_facturas","meijsac_retenciones","meijsac_ventas_pos","meijsac_restaurante_facturas","meijsac_enviados_sri","meijsac_comprobantes_pendientes_sri"]
    todosKeys.forEach(k=>{
      const lista = JSON.parse(localStorage.getItem(k)||"[]")
      const nueva = lista.map((d:any)=>{
        const sec = d.secuencial || d.numRetencion
        if(sec===showAnular.secuencial || String(d.claveAcceso || d.clave || "").replace(/\D/g, "") === String(showAnular.claveAcceso || "").replace(/\D/g, "")){
          return {...d, estadoSRI:'ANULADO', estado:'ANULADO', motivoAnulacion:'Anulado en SRI en Linea', fechaAnulacion: new Date().toISOString()}
        }
        return d
      })
      localStorage.setItem(k, JSON.stringify(nueva))
    })
    if (showAnular.facturaId) {
      await fetch("/api/facturas", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("meijsac_token") || ""}` }, body: JSON.stringify({ id: showAnular.facturaId, accion: "ANULAR" }) })
    }
    setClaveAnular("")
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
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 p-6 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push("/dashboard/comprobantes")} className="text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl">← Comprobantes</button>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
            <h1 className="text-lg font-semibold text-white">Historial de comprobantes</h1>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-md border border-slate-700">{docs.length} docs</span>
          </div>
        </div>
        <input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar secuencial, cliente o RUC..." className="w-full md:w-72 bg-[#111827] border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400" />
      </div>
      <div className="max-w-7xl mx-auto flex gap-2 mb-4 flex-wrap">
        {[["todos","Todos"],["pagado","Contado"],["pendiente","Pendientes de pago"],["credito","Crédito"]].map(([id,label]) => (
          <button key={id} onClick={()=>setFiltroCobro(id)} className={`px-4 py-1.5 rounded-xl text-xs font-medium ${filtroCobro===id?"bg-teal-400 text-slate-950 font-bold":"bg-[#111827] text-slate-400 border border-slate-800"}`}>{label}</button>
        ))}
      </div>
      <div className="max-w-7xl mx-auto">

      {/* SECCION BORRADORES - FECHA SIEMPRE HOY NORMA SRI */}
      {borradores.length>0 && (
        <div className="bg-[#111827] border border-slate-700 rounded-2xl p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Borradores sin emitir ({borradores.length})</h2>
            <span className="text-[10px] text-slate-400 border border-slate-700 rounded-lg px-2 py-1">Fecha de hoy: {new Date().toLocaleDateString("es-EC")}</span>
          </div>
          <div className="grid gap-2">
            {borradores.map((b:any)=>(
              <div key={b.id} className="grid grid-cols-12 p-3 bg-[#0B0F19] rounded-xl text-[11px] items-center border border-slate-800">
                <div className="col-span-2"><span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg text-[9px]">Borrador</span></div>
                <div className="col-span-2 font-mono text-slate-300">{b.secuencialTemp || b.secuencial}</div>
                <div className="col-span-3 truncate">{b.receptorNombre}</div>
                <div className="col-span-2 text-[10px] text-slate-500">{new Date(b.fechaCreacion || b.fechaISO || Date.now()).toLocaleString("es-EC")}</div>
                <div className="col-span-1 font-mono">${Number(b.total || b.valorTotal || 0).toFixed(2)}</div>
                <div className="col-span-2 flex justify-end gap-1">
                  <button onClick={()=>{
                    localStorage.setItem("meijsac_borrador_activo", JSON.stringify(b))
                    router.push("/dashboard/factura-xml?borrador="+b.id)
                  }} className="bg-teal-400 text-slate-950 px-3 py-1 rounded-lg text-[10px] font-bold">Continuar</button>
                  <button onClick={()=>{ const list = borradores.filter((x:any)=>x.id!==b.id); localStorage.setItem("meijsac_borradores_facturas", JSON.stringify(list)); setBorradores(list) }} className="text-slate-500 px-2 py-1 rounded-lg text-[10px]">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCION PENDIENTES - AUTO SRI */}
      {pendientes.length>0 && (
        <div className="bg-[#111827] border border-amber-500/30 rounded-2xl p-5 mb-6">
          <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-3">
            <h2 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Pendientes de autorizar en el SRI ({pendientes.length})</h2>
            <button onClick={() => reenviarPendientes(pendientes, true).then(() => cargar())} className="bg-amber-400/10 hover:bg-amber-400 text-amber-300 hover:text-slate-950 border border-amber-400/30 font-semibold px-4 py-1.5 rounded-xl text-xs">Enviar todos al SRI</button>
          </div>
          <div className="divide-y divide-slate-800/60">
            {pendientes.map((p:any)=>(
              <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px]">{nombreTipo(p.tipoComprobante)}</span>
                  <div>
                    <p className="font-mono text-white">{p.secuencial}</p>
                    <p className="text-[11px] text-slate-400">{p.receptorNombre}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] text-slate-500">Intentos: {p.intentos || 0}</span>
                  <span className="font-mono text-white">${Number(p.valorTotal).toFixed(2)}</span>
                  <span className="text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg">{p.estadoSRI}</span>
                  <button onClick={() => reenviarPruebas(p)} className="bg-teal-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-[11px]">Reenviar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#111827] border border-slate-800/80 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-3 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
          <div className="col-span-1">Tipo</div>
          <div className="col-span-2">Secuencial</div>
          <div className="col-span-2">Fecha</div>
          <div className="col-span-1">Receptor</div>
          <div className="col-span-1 text-right">Total</div>
          <div className="col-span-1">Estado SRI</div>
          <div className="col-span-1">Cobro</div>
          <div className="col-span-1">Pago</div>
          <div className="col-span-2 text-right">Acciones</div>
        </div>
        {filtrados.map((d,i)=>{
          const pago = insigniaPago(d)
          return (
          <div key={i} className={`grid grid-cols-12 px-4 py-3 border-t border-slate-800/60 text-[11px] items-center hover:bg-slate-800/30 ${d.estadoSRI==='ANULADO'?'opacity-40':''}`}>
            <div className="col-span-1"><span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg text-[10px]">{nombreTipo(d.tipoComprobante)}</span></div>
            <div className="col-span-2 font-mono text-slate-200">{d.secuencial}</div>
            <div className="col-span-2 text-slate-300">{d.fechaEmision || "—"}</div>
            <div className="col-span-1 truncate"><span className="text-white">{d.receptorNombre}</span><span className="block text-[10px] text-slate-500 font-mono">{d.receptorIdentificacion}</span></div>
            <div className="col-span-1 text-right font-mono text-white">${d.estadoSRI==='ANULADO'?'0.00':Number(d.valorTotal||0).toFixed(2)}</div>
            <div className="col-span-1"><span className={`px-2 py-1 rounded-lg text-[10px] border ${d.estadoSRI==='AUTORIZADO'?'bg-teal-500/10 text-teal-300 border-teal-500/30': d.estadoSRI==='ANULADO'?'bg-slate-800 text-slate-400 border-slate-700':'bg-amber-500/10 text-amber-200 border-amber-500/30'}`}>{d.estadoSRI==='ANULADO'?'Anulado': d.estadoSRI==='AUTORIZADO'?'Autorizado': d.estadoSRI==='RECHAZADO'?'Rechazado':'Pendiente'}</span></div>
            <div className="col-span-1 text-[10px] text-slate-400">{d.tipo_cobro === "CREDITO" ? "Crédito" : d.tipo_cobro === "PENDIENTE_DE_PAGO" ? "Por cobrar" : "Contado"}</div>
            <div className="col-span-1"><button onClick={() => { if (pago.texto !== "Pagado") setPagoDoc(d) }} className={`px-2 py-1 rounded-lg text-[10px] ${pago.clase}`}>{pago.texto}</button></div>
            <div className="col-span-2 flex justify-end items-center gap-1.5 flex-nowrap">
              <button onClick={()=>verImprimir(d)} className="bg-teal-400 text-slate-950 px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap">Ver / Imprimir</button>
              <button onClick={()=>descargarXML(d)} className="bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-[10px]">XML</button>
              <button onClick={()=>setShowAnular(d)} title="Anular" className="text-slate-500 hover:text-rose-400 px-1.5 py-1">✕</button>
            </div>
          </div>
        )})}
      </div>
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
            <input type="password" value={claveAnular} onChange={(e) => setClaveAnular(e.target.value)} placeholder="Contraseña de ingreso" className="w-full mb-3 bg-black border border-white/10 rounded-xl p-3 text-sm" />
            <div className="flex gap-2">
              <button onClick={()=>{ setClaveAnular(""); setShowAnular(null) }} className="flex-1 bg-white/10 py-3 rounded-xl text-xs font-bold">Cancelar</button>
              <button onClick={anularLogico} className="flex-1 bg-red-500 text-white py-3 rounded-xl text-xs font-black hover:bg-red-600">✓ Ya anulé en SRI → ANULADO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}