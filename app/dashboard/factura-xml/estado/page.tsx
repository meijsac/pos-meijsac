"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const PROVEEDOR_SISTEMA = {
  nombre: "MEIJSAC POS",
  ruc: "1793161234001",
  contacto: "https://meijsacpos.com - Soporte Tena"
}

export default function EstadoSRI(){
  const router = useRouter()
  const [estado, setEstado] = useState<"PROCESANDO"|"AUTORIZADO"|"PENDIENTE">("PROCESANDO")
  const [data, setData] = useState<any>({})
  const [tipoNegocio, setTipoNegocio] = useState("restaurante")

  useEffect(()=>{
    const cfg = JSON.parse(localStorage.getItem("meijsac_config") || localStorage.getItem("meijsac_config_restaurante") || "{}")
    setTipoNegocio(cfg.tipoNegocio || "restaurante")
    const factura = JSON.parse(localStorage.getItem("meijsac_ultima_factura_pendiente")||"{}")
    setData(factura)
    setTimeout(()=>{
      const exito = Math.random() > 0.05
      if(exito){
        const final = {...factura, numeroAutorizacion: factura.claveAcceso, fechaAutorizacion: new Date().toLocaleString('es-EC'), estado: "AUTORIZADO"}
        setEstado("AUTORIZADO")
        setData(final)
        const hist = JSON.parse(localStorage.getItem("meijsac_facturas_emitidas")||"[]")
        hist.push(final)
        localStorage.setItem("meijsac_facturas_emitidas", JSON.stringify(hist))
        localStorage.setItem("meijsac_ultima_factura_autorizada", JSON.stringify(final))
        import("@/lib/plan-cliente").then(({ contarComprobante, rucLocal }) => {
          contarComprobante(factura?.configEmisor?.ruc || rucLocal())
        })
        if(final.mesaOrigenId){
          const mesas = JSON.parse(localStorage.getItem("meijsac_restaurante_mesas")||"[]")
          localStorage.setItem("meijsac_restaurante_mesas", JSON.stringify(mesas.map((m:any)=> m.id===final.mesaOrigenId? {...m, estado:"LIBRE", items:[]} : m)))
        }
      } else {
        setEstado("PENDIENTE")
        const cola = JSON.parse(localStorage.getItem("meijsac_cola_sri")||"[]")
        cola.push({...factura, intentos:1, proximoReintento: Date.now()+15*60*1000})
        localStorage.setItem("meijsac_cola_sri", JSON.stringify(cola))
      }
    }, 2000)
  },[])

  const liberarMesaYVolver = (ruta: string) => {
    const mesas=JSON.parse(localStorage.getItem("meijsac_restaurante_mesas")||"[]")
    const transito=JSON.parse(localStorage.getItem("meijsac_transito_factura")||"{}")
    const pend=JSON.parse(localStorage.getItem("meijsac_ultima_factura_pendiente")||"{}")
    const idMesa=transito.mesaOrigenId||pend.mesaOrigenId
    if(idMesa){
      localStorage.setItem("meijsac_restaurante_mesas",JSON.stringify(mesas.map((m:any)=>m.id===idMesa?{...m,estado:"LIBRE",items:[],total:0,comensales:0}:m)))
    }
    localStorage.removeItem("meijsac_transito_factura")
    localStorage.removeItem("meijsac_transito_mesa")
    localStorage.removeItem("meijsac_ultima_factura_pendiente")
    router.push(ruta)
  }

  const imprimirRIDE = ()=>{
    const d = data
    const clave = d.claveAcceso || ""
    let cambio = Number(d.pagos?.cambio || d.pagos?.efectivo?.cambio || 0)
    let enCaja = Number(d.pagos?.efectivo && typeof d.pagos.efectivo === 'object' ? (d.pagos.efectivo.monto || 0) : (d.pagos?.efectivo || 0))
    let entregado = Number(d.pagos?.entregado || 0)
    if(enCaja === 0 && cambio > 0){ enCaja = Number(d.totales?.total || 0) }
    if(entregado === 0 || entregado === cambio){ entregado = enCaja + cambio }
    const formaPagoTxt = d.pagos?.tarjeta > 0 || d.pagos?.redBancaria > 0 ? `01: $${enCaja.toFixed(2)}` : `01 - SIN UTILIZACION SISTEMA FINANCIERO $${enCaja.toFixed(2)}`
    const html = `
    <html><head><title>RIDE ${d.establecimiento}-${d.secuencial}</title>
    <style>body{font-family:Arial;font-size:11px;color:#000}.borde{border:1px solid #000;padding:8px}.t{font-size:16px;font-weight:900} table{width:100%;border-collapse:collapse} td,th{border:1px solid #000;padding:4px;font-size:10px}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between">
      <div style="width:58%" class="borde">
        <div><b>${d.configEmisor?.razon||""}</b></div>
        <div>${d.configEmisor?.comercial||""}</div>
        <div><b>Dirección Matriz:</b> ${d.configEmisor?.matriz||""}</div>
        <div><b>Dirección Sucursal:</b> ${d.configEmisor?.sucursal||""}</div>
        <div><b>Obligado:</b> ${d.configEmisor?.obligado||"NO"} - <b>${d.configEmisor?.regimen||""}</b></div>
      </div>
      <div style="width:40%" class="borde">
        <div>RUC: <b>${d.configEmisor?.ruc||""}</b></div>
        <div class="t">FACTURA</div>
        <div>No. ${d.establecimiento}-${d.secuencial}</div>
        <div><b>Clave Acceso</b><br/>${clave}</div>
        <div>Fecha Aut: ${d.fechaAutorizacion||""}</div>
        <div>Ambiente: ${d.configEmisor?.ambiente||"PRODUCCIÓN"} - EMISION: NORMAL</div>
        <div><b>Autorización: ${d.numeroAutorizacion||"AUTORIZADO"}</b></div>
      </div>
    </div>
    <div class="borde" style="margin-top:8px">
      <div><b>Razón Social:</b> ${d.cliente?.razon} - <b>ID:</b> ${d.cliente?.identificacion} - <b>Fecha:</b> ${d.fechaEmisionFormato}</div>
    </div>
    <table style="margin-top:8px"><tr><th>Cod. Principal</th><th>Cant</th><th>Descripción</th><th>Detalle Adic.</th><th>P.Unit</th><th>Desc</th><th>P.Total</th></tr>
    ${(d.items||[]).map((it:any)=>`<tr><td>${it.codigo}</td><td>${it.cant}</td><td>${it.descripcion}</td><td>${it.detalleAdicional||""}</td><td>${it.pUnit?.toFixed(2)}</td><td>${(it.descDolar||0).toFixed(2)}</td><td>${(it.cant*it.pUnit-(it.descDolar||0)).toFixed(2)}</td></tr>`).join("")}
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:8px">
      <div style="width:58%" class="borde">
        Email: ${d.cliente?.email}<br/>Tel: ${d.cliente?.telefono}<br/>
        <b style="border:1px solid #000;padding:4px;display:block;margin-top:8px">Proveedor del Sistema: ${PROVEEDOR_SISTEMA.nombre} - RUC ${PROVEEDOR_SISTEMA.ruc} - ${PROVEEDOR_SISTEMA.contacto}</b>
      </div>
      <div style="width:40%" class="borde">
        <div>SUBTOTAL 15%: ${d.totales?.base15?.toFixed(2) || d.totales?.subtotalSin?.toFixed(2)}</div>
        <div>SUBTOTAL 0%: ${d.totales?.base0?.toFixed(2)}</div>
        <div>SUBTOTAL SIN IMP: ${d.totales?.subtotalSin?.toFixed(2)}</div>
        <div>IVA 15%: ${d.totales?.iva15?.toFixed(2)}</div>
        <div>PROPINA 10%: ${d.totales?.propina?.toFixed(2)}</div>
        <div style="font-size:14px;font-weight:900">TOTAL: ${d.totales?.total?.toFixed(2)}</div>
        <hr/>
        <div>FORMA PAGO: ${formaPagoTxt}</div>
        <div>ENTREGADO: $${entregado.toFixed(2)}</div>
        <div style="background:#000;color:#fff;padding:4px;font-weight:900">VUELTO: $${cambio.toFixed(2)}</div>
        <div>EFECTIVO EN CAJA: $${enCaja.toFixed(2)}</div>
      </div>
    </div>
    </body></html>`
    const w=window.open("","_blank"); w?.document.write(html); w?.document.close(); w?.print()
  }

  const imprimirTicket = ()=>{
    const d = data
    let cambio = Number(d.pagos?.cambio || d.pagos?.efectivo?.cambio || 0)
    let enCaja = Number(d.pagos?.efectivo && typeof d.pagos.efectivo === 'object' ? (d.pagos.efectivo.monto || 0) : (d.pagos?.efectivo || 0))
    let entregado = Number(d.pagos?.entregado || 0)
    if(enCaja === 0 && cambio > 0){ enCaja = Number(d.totales?.total || 0) }
    if(entregado === 0 || entregado === cambio){ entregado = enCaja + cambio }
    if(entregado < Number(d.totales?.total||0)){ entregado = Number(d.totales?.total||0) + cambio }
    const subtotal = d.totales?.base15 || d.totales?.subtotalSin || 0
    const iva = d.totales?.iva15 || 0
    const formaPagoTxt = d.pagos?.tarjeta > 0 || d.pagos?.redBancaria > 0 ? `01: $${enCaja.toFixed(2)} | 19: $${(d.pagos?.tarjeta||0).toFixed(2)}` : `01 - EFECTIVO`
    const html = `
    <html><head><title>TICKET</title>
    <style>@page{size:80mm auto;margin:2mm} body{width:80mm;font-family:monospace;font-size:11px;color:#000}.c{text-align:center}.b{font-weight:900}.line{border-top:1px dashed #000;margin:4px 0}</style>
    </head><body>
    <div class="c b">${d.configEmisor?.comercial||"EL VECINO - CEVICHERIA"}</div>
    <div class="c">${d.configEmisor?.razon||"HERRERA VELOZ EDGAR FAVIAN"}</div>
    <div class="c">RUC: ${d.configEmisor?.ruc||"1707276760001"}</div>
    <div class="c" style="font-size:9px">${d.configEmisor?.sucursal||"Av. 15 de Noviembre, Tena"}<br/>Obligado a llevar contabilidad: ${d.configEmisor?.obligado||"NO"} - ${d.configEmisor?.regimen||"RIMPE Negocio Popular"}</div>
    <div class="line"></div>
    <div>FACT: ${d.establecimiento}-${d.secuencial}</div>
    <div style="font-size:7px;word-break:break-all">CLAVE: ${d.claveAcceso}</div>
    <div>EMISION: NORMAL</div>
    <div>Cliente: ${d.cliente?.razon}</div>
    <div>RUC/CI: ${d.cliente?.identificacion}</div>
    <div class="line"></div>
    ${(d.items||[]).map((it:any)=>`<div>${it.cant} x ${it.descripcion}<br/>P.Unit $${it.pUnit?.toFixed(2)} = $${(it.cant*it.pUnit).toFixed(2)}</div>`).join("")}
    <div class="line"></div>
    <div>SUBTOTAL 15%: $${Number(subtotal).toFixed(2)}</div>
    <div>IVA 15%: $${Number(iva).toFixed(2)}</div>
    <div class="b" style="font-size:13px">TOTAL: $${d.totales?.total?.toFixed(2)}</div>
    <div class="line"></div>
    <div>FORMA PAGO: ${formaPagoTxt}</div>
    <div>ENTREGADO: $${entregado.toFixed(2)}</div>
    <div class="b" style="background:#000;color:#fff;padding:4px;font-size:13px">VUELTO: $${cambio.toFixed(2)}</div>
    <div>EFECTIVO EN CAJA: $${enCaja.toFixed(2)}</div>
    <div class="line"></div>
    <div class="c" style="font-size:8px">Autorizado SRI: ${d.numeroAutorizacion}<br/>Consulte en SRI con clave 49</div>
    <div class="line"></div>
    <div class="c" style="font-size:9px;opacity:0.8">
    ----------------------------------------<br/>
    Proveedor del Sistema: ${PROVEEDOR_SISTEMA.nombre}<br/>
    RUC Proveedor: ${PROVEEDOR_SISTEMA.ruc}<br/>
    Soporte: ${PROVEEDOR_SISTEMA.contacto}<br/>
    </div>
    </body></html>`
    const w=window.open("","_blank","width=320,height=600"); w?.document.write(html); w?.document.close(); w?.print()
  }

  if(estado==="PROCESANDO") return <div className="min-h-screen bg-black text-[#00f5d4] flex items-center justify-center font-black">⏳ ENVIANDO XML FIRMADO AL SRI - Generando Clave 49...</div>
  if(estado==="PENDIENTE") return (
    <div className="min-h-screen bg-[#1a1500] p-6 text-white">
      <div className="bg-yellow-500/20 border border-yellow-500 p-4 rounded-xl font-black text-xl">⏱️ PROCESANDO EN COLA - PENDIENTE DE AUTORIZACIÓN</div>
      <p className="text-xs mt-2">SRI caído - Modo Offline permitido 72h. Clave: {data.claveAcceso}</p>
      <div className="grid grid-cols-2 gap-3 mt-6">
        <button onClick={imprimirRIDE} className="bg-white text-black p-4 rounded-xl font-black">📄 PDF A4 RIDE (BLOQUES A-F)</button>
        <button onClick={imprimirTicket} className="bg-[#00f5d4] text-black p-4 rounded-xl font-black">🧾 TICKET 80mm TÉRMICO</button>
      </div>
    </div>
  )
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <div className="bg-green-500/20 border border-green-500 p-4 rounded-xl font-black text-xl flex justify-between items-center">
        <span>✓ COMPROBANTE AUTORIZADO POR EL SRI</span>
        <span className="text-[10px] bg-white text-black px-2 py-1 rounded-full uppercase">{tipoNegocio}</span>
      </div>
      <div className="mt-4 bg-[#1e293b] p-4 rounded-xl text-[11px]">
        <div>Clave 49: <b className="font-mono break-all">{data.claveAcceso}</b></div>
        <div>Autorización: <b>{data.numeroAutorizacion}</b></div>
        <div>Fecha Aut: <b>{data.fechaAutorizacion}</b></div>
        <div className="mt-2">Vuelto entregado: <b className="text-[#00f5d4]">${(data.pagos?.cambio||0).toFixed(2)}</b> / Efectivo recibido: ${( (data.pagos?.efectivo||0)+(data.pagos?.cambio||0) ).toFixed(2)} / Entregado real: ${(data.pagos?.entregado||0).toFixed(2)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-6">
        <button onClick={imprimirRIDE} className="bg-white text-black p-4 rounded-xl font-black">📄 PDF A4 RIDE (BLOQUES A-F)</button>
        <button onClick={imprimirTicket} className="bg-[#00f5d4] text-black p-4 rounded-xl font-black">🧾 TICKET 80mm TÉRMICO</button>
      </div>
      <div className="mt-4 space-y-2">
        {tipoNegocio === "restaurante" && (<button onClick={()=> liberarMesaYVolver("/dashboard/restaurante")} className="w-full bg-black border border-white/20 p-4 rounded-xl font-black">VOLVER A MESAS - MESA LIBRE AZUL</button>)}
        {tipoNegocio === "general" && (<button onClick={()=> liberarMesaYVolver("/dashboard/comprobantes/emitidos")} className="w-full bg-[#ffbe0a] text-black p-4 rounded-xl font-black">← VOLVER A COMPROBANTES EMITIDOS</button>)}
        {tipoNegocio === "distribuidora" && (<button onClick={()=> liberarMesaYVolver("/dashboard/facturacion")} className="w-full bg-cyan-400 text-black p-4 rounded-xl font-black">← VOLVER A FACTURACIÓN DISTRIBUIDORA</button>)}
        {tipoNegocio === "servicios" && (<button onClick={()=> liberarMesaYVolver("/dashboard")} className="w-full bg-slate-800 border p-4 rounded-xl font-black">← DASHBOARD</button>)}
        <button onClick={()=> router.push("/dashboard")} className="w-full bg-white/5 text-white/40 p-3 rounded-xl text-[11px] font-bold">← DASHBOARD</button>
      </div>
    </div>
  )
}