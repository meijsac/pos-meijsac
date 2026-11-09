"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const PIE_PROVEEDOR = "Proveedor del Sistema: MEIJSAC S.A.S. - RUC: 1793243789001 - Soporte Quito"
const FORMA_PAGO_DEFECTO = "01 - SIN UTILIZACION DEL SISTEMA FINANCIERO"

function numeroGuardado(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function cobroGuardado(d: any) {
  const pagos = d?.pagos || {}
  const total = numeroGuardado(d?.totales?.total) ?? 0
  const vuelto = numeroGuardado(pagos.vuelto) ?? numeroGuardado(pagos.cambio) ?? 0
  const efectivoNeto = numeroGuardado(typeof pagos.efectivo === "object" ? pagos.efectivo?.monto : pagos.efectivo) ?? 0
  const efectivoRecibido = numeroGuardado(pagos.efectivoRecibido) ?? numeroGuardado(d?.efectivoRecibido) ?? (efectivoNeto + vuelto)
  const entregadoGuardado = numeroGuardado(pagos.entregado) ?? numeroGuardado(d?.montoEntregado)
  const entregado = entregadoGuardado !== null && entregadoGuardado > 0
    ? entregadoGuardado
    : (efectivoRecibido > 0 ? efectivoRecibido : total)
  const formaPago = pagos.formaPago || d?.formaPago || FORMA_PAGO_DEFECTO
  return { formaPago, entregado, efectivoRecibido: efectivoRecibido > 0 ? efectivoRecibido : entregado, vuelto }
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
    const cobro = cobroGuardado(factura)
    const facturaConCobro = {...factura, formaPago: cobro.formaPago, montoEntregado: cobro.entregado, efectivoRecibido: cobro.efectivoRecibido, vuelto: cobro.vuelto, pagos: {...(factura.pagos||{}), ...cobro, cambio: cobro.vuelto, entregado: cobro.entregado}}
    setData(facturaConCobro)
    setTimeout(()=>{
      const exito = Math.random() > 0.05
      if(exito){
        const final = {...facturaConCobro, numeroAutorizacion: factura.claveAcceso, fechaAutorizacion: new Date().toLocaleString('es-EC'), estado: "AUTORIZADO"}
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
    const errores: string[] = []
    const numFinito = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null
      const n = typeof v === "number" ? v : Number(v)
      return Number.isFinite(n) ? n : null
    }
    const exigir = (nombre: string, guardado: unknown, calculado: () => number | null) => {
      const directo = numFinito(guardado)
      if (directo !== null) return directo
      const calculo = calculado()
      if (calculo !== null) return calculo
      errores.push(nombre)
      return null
    }
    const items: any[] = Array.isArray(d.items) ? d.items : []
    const baseDe = (codigos: string[]) => {
      if (!Array.isArray(d.items)) return null
      let suma = 0
      for (const it of items) {
        if (!codigos.includes(String(it?.codigoPorcentaje))) continue
        const cant = numFinito(it?.cant)
        const pUnit = numFinito(it?.pUnit)
        if (cant === null || pUnit === null) return null
        const descPorc = numFinito(it?.descPorc)
        suma += cant * pUnit * (descPorc === null ? 1 : 1 - descPorc / 100)
      }
      return suma
    }
    const base15 = exigir("Subtotal 15%", d.totales?.base15, () => baseDe(["4"]))
    const base0 = exigir("Subtotal 0%", d.totales?.base0, () => baseDe(["0"]))
    const baseNoObjeto = exigir("Subtotal No objeto de IVA", d.totales?.baseNoObjeto, () => baseDe(["6"]))
    const baseExento = exigir("Subtotal Exento de IVA", d.totales?.baseExento, () => baseDe(["7"]))
    const descuento = exigir("Total Descuentos", d.totales?.descuento, () => {
      if (!Array.isArray(d.items)) return null
      let suma = 0
      for (const it of items) {
        const cant = numFinito(it?.cant)
        const pUnit = numFinito(it?.pUnit)
        const descPorc = numFinito(it?.descPorc)
        const descDolar = numFinito(it?.descDolar)
        if (cant === null || pUnit === null) return null
        suma += descPorc !== null ? cant * pUnit * descPorc / 100 : (descDolar ?? 0)
      }
      return suma
    })
    const ice = exigir("ICE", d.totales?.valorICE, () => {
      if (!Array.isArray(d.items)) return null
      let suma = 0
      for (const it of items) {
        if (it?.ice === undefined) continue
        const valor = numFinito(it.ice)
        if (valor === null) return null
        suma += valor
      }
      return suma
    })
    const iva = exigir("IVA oficial", d.totales?.iva15, () => base15 === null ? null : Math.round(base15 * 0.15 * 100) / 100)
    const propina = exigir("Propina", d.totales?.propina, () => null)
    const total = exigir("Valor Total", d.totales?.total, () => null)
    const filas = items.map((it: any) => {
      const cant = numFinito(it?.cant)
      const pUnit = numFinito(it?.pUnit)
      const descDolar = numFinito(it?.descDolar)
      if (cant === null || pUnit === null) {
        errores.push(`Precio o cantidad de ${it?.descripcion || it?.codigo || "un producto"}`)
        return ""
      }
      if (it?.descDolar !== undefined && it?.descDolar !== null && it?.descDolar !== "" && descDolar === null) {
        errores.push(`Descuento de ${it?.descripcion || it?.codigo || "un producto"}`)
        return ""
      }
      const desc = descDolar ?? 0
      const precioTotal = cant * pUnit - desc
      if (!Number.isFinite(precioTotal)) {
        errores.push(`Total de línea ${it?.descripcion || it?.codigo || ""}`)
        return ""
      }
      return `<tr><td>${it.codigo ?? ""}</td><td class="num">${cant}</td><td>${it.descripcion ?? ""}</td><td>${it.detalleAdicional || ""}</td><td class="num">$${pUnit.toFixed(2)}</td><td class="num">$${desc.toFixed(2)}</td><td class="num">$${precioTotal.toFixed(2)}</td></tr>`
    })
    if (errores.length) {
      alert(`No se emite el RIDE. Hay valores vacíos que no se pueden calcular: ${[...new Set(errores)].join(", ")}.`)
      return
    }
    const usd = (n: number) => `$${n.toFixed(2)}`
    const cobro = cobroGuardado(d)
    const formas: { codigo: string, nombre: string, monto: number }[] = []
    const sumarForma = (codigo: string, nombre: string, valor: unknown) => {
      const monto = numFinito(valor)
      if (monto !== null && monto > 0) formas.push({ codigo, nombre, monto })
    }
    const efectivo = numFinito(d.pagos?.efectivo && typeof d.pagos.efectivo === "object" ? d.pagos.efectivo.monto : d.pagos?.efectivo)
    sumarForma("01", "SIN UTILIZACION DEL SISTEMA FINANCIERO", efectivo)
    sumarForma("15", "COMPENSACION DE DEUDAS", d.pagos?.compensacion)
    sumarForma("16", "TARJETA DE DEBITO", d.pagos?.debito)
    sumarForma("17", "DINERO ELECTRONICO", d.pagos?.dineroElec)
    sumarForma("18", "TARJETA PREPAGO", d.pagos?.prepago)
    sumarForma("19", "TARJETA DE CREDITO", d.pagos?.tarjeta)
    const red = numFinito(d.pagos?.redBancaria)
    const credito = numFinito(d.pagos?.credito)
    if (red !== null || credito !== null) sumarForma("20", "OTROS CON UTILIZACION DEL SISTEMA FINANCIERO", (red ?? 0) + (credito ?? 0))
    sumarForma("21", "ENDOSO DE TITULOS", d.pagos?.endoso)
    if (formas.length === 0) formas.push({ codigo: "", nombre: cobro.formaPago, monto: cobro.entregado })
    const entregado = cobro.entregado
    const cambio = cobro.vuelto
    const clave = String(d.claveAcceso || "")
    const autorizacion = d.numeroAutorizacion ? String(d.numeroAutorizacion) : (estado === "AUTORIZADO" ? clave : "PENDIENTE DE AUTORIZACION")
    const html = `<!DOCTYPE html><html><head><title>RIDE ${d.establecimiento}-${d.secuencial}</title>
    <style>
      @page { size: A4 portrait; margin: 8mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { width: 194mm; margin: 0 auto; font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; text-align: left; }
      .top, .abajo { display: flex; gap: 4mm; align-items: stretch; }
      .izq { width: 58%; min-width: 0; }
      .der { width: 42%; min-width: 0; }
      .borde { border: 1px solid #000; padding: 2.5mm; overflow: hidden; }
      .factura { font-size: 14px; font-weight: 900; margin: 1mm 0; }
      .lbl { font-size: 8px; font-weight: 700; margin-top: 1.5mm; }
      .clave { display: block; width: 100%; max-width: 100%; min-height: 8mm; margin-top: 0.6mm; padding: 1mm; border: 1px solid #000; font-family: "Courier New", Courier, monospace; font-size: 8px; line-height: 1.35; font-weight: 700; word-break: break-all; overflow-wrap: anywhere; white-space: normal; letter-spacing: 0; }
      table { width: 100%; margin-top: 3mm; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #000; padding: 1.2mm 1mm; font-size: 8px; vertical-align: top; text-align: left; word-wrap: break-word; overflow-wrap: anywhere; }
      th { font-size: 7px; }
      td.num, th.num { text-align: right; white-space: nowrap; }
      .info { width: 54%; min-width: 0; }
      .tot { width: 46%; min-width: 0; text-align: left; }
      .linea { display: flex; justify-content: space-between; gap: 3mm; padding: 0.4mm 0; text-align: left; }
      .linea span:first-child { text-align: left; }
      .linea b { text-align: right; white-space: nowrap; }
      .total { font-size: 12px; font-weight: 900; border-top: 1px solid #000; margin-top: 1mm; padding-top: 1mm; }
      .pagos { text-align: left; margin-top: 2mm; border-top: 1px solid #000; padding-top: 1.5mm; }
      .pago { text-align: left; word-break: break-word; overflow-wrap: anywhere; padding: 0.3mm 0; }
      .vuelto { text-align: left; background: #000; color: #fff; font-weight: 900; padding: 1mm; margin-top: 1mm; }
      .pie { display: block; width: 100%; margin-top: 2mm; padding: 1.5mm; border: 1px solid #000; font-size: 8px; font-weight: 700; text-align: left; word-break: break-word; }
    </style></head><body>
    <div class="top">
      <div class="izq borde">
        <div><b>${d.configEmisor?.razon || ""}</b></div>
        <div>${d.configEmisor?.comercial || ""}</div>
        <div><b>Dirección Matriz:</b> ${d.configEmisor?.matriz || ""}</div>
        <div><b>Dirección Sucursal:</b> ${d.configEmisor?.sucursal || ""}</div>
        <div><b>Obligado a llevar contabilidad:</b> ${d.configEmisor?.obligado || "NO"}</div>
        <div><b>${d.configEmisor?.regimen || ""}</b></div>
      </div>
      <div class="der borde">
        <div>R.U.C.: <b>${d.configEmisor?.ruc || ""}</b></div>
        <div class="factura">FACTURA</div>
        <div>No. ${d.establecimiento || ""}-${d.secuencial || ""}</div>
        <div class="lbl">NÚMERO DE AUTORIZACIÓN</div>
        <div class="clave">${autorizacion}</div>
        <div>Fecha y hora de autorización: ${d.fechaAutorizacion || ""}</div>
        <div>Ambiente: ${d.configEmisor?.ambiente || "PRODUCCIÓN"}</div>
        <div>Emisión: NORMAL</div>
        <div class="lbl">CLAVE DE ACCESO</div>
        <div class="clave">${clave}</div>
      </div>
    </div>
    <div class="borde" style="margin-top:3mm">
      <div><b>Razón Social / Nombres y Apellidos:</b> ${d.cliente?.razon || ""}</div>
      <div><b>Identificación:</b> ${d.cliente?.identificacion || ""} &nbsp; <b>Fecha de emisión:</b> ${d.fechaEmisionFormato || ""}</div>
      <div><b>Dirección:</b> ${d.cliente?.direccion || ""}</div>
    </div>
    <table>
      <colgroup>
        <col style="width:13%"/><col style="width:7%"/><col style="width:28%"/><col style="width:16%"/><col style="width:12%"/><col style="width:11%"/><col style="width:13%"/>
      </colgroup>
      <tr><th>Cod. Principal</th><th class="num">Cant.</th><th>Descripción</th><th>Detalle adicional</th><th class="num">Precio unitario</th><th class="num">Descuento</th><th class="num">Precio total</th></tr>
      ${filas.join("")}
    </table>
    <div class="abajo" style="margin-top:3mm">
      <div class="info borde">
        <b>Información adicional</b>
        <div>Dirección: ${d.cliente?.direccion || ""}</div>
        <div>Teléfono: ${d.cliente?.telefono || ""}</div>
        <div>Email: ${d.cliente?.email || ""}</div>
        <div class="pie">${PIE_PROVEEDOR}</div>
      </div>
      <div class="tot borde">
        <div class="linea"><span>SUBTOTAL 15%</span><b>${usd(base15!)}</b></div>
        <div class="linea"><span>SUBTOTAL 0%</span><b>${usd(base0!)}</b></div>
        <div class="linea"><span>SUBTOTAL NO OBJETO DE IVA</span><b>${usd(baseNoObjeto!)}</b></div>
        <div class="linea"><span>SUBTOTAL EXENTO DE IVA</span><b>${usd(baseExento!)}</b></div>
        <div class="linea"><span>TOTAL DESCUENTO</span><b>${usd(descuento!)}</b></div>
        <div class="linea"><span>ICE</span><b>${usd(ice!)}</b></div>
        <div class="linea"><span>IVA</span><b>${usd(iva!)}</b></div>
        <div class="linea"><span>PROPINA 10%</span><b>${usd(propina!)}</b></div>
        <div class="linea total"><span>VALOR TOTAL</span><b>${usd(total!)}</b></div>
        <div class="pagos">
          <div><b>FORMAS DE PAGO (Tabla 24)</b></div>
          ${formas.map(f => `<div class="pago">${f.codigo ? `${f.codigo} - ${f.nombre}` : f.nombre} ${usd(f.monto)}</div>`).join("")}
          <div class="pago">ENTREGADO: ${usd(entregado)}</div>
          <div class="vuelto">VUELTO: ${usd(cambio)}</div>
        </div>
      </div>
    </div>
    </body></html>`
    const w = window.open("", "_blank")
    w?.document.write(html)
    w?.document.close()
    w?.print()
  }

  const imprimirTicket = ()=>{
    const d = data
    const cobro = cobroGuardado(d)
    const cambio = cobro.vuelto
    const entregado = cobro.entregado
    const enCaja = numeroGuardado(typeof d.pagos?.efectivo === "object" ? d.pagos?.efectivo?.monto : d.pagos?.efectivo) ?? cobro.efectivoRecibido
    const subtotal = d.totales?.base15 || d.totales?.subtotalSin || 0
    const iva = d.totales?.iva15 || 0
    const formaPagoTxt = cobro.formaPago
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
    <div class="c" style="font-size:9px;word-break:break-word">
    ----------------------------------------<br/>
    ${PIE_PROVEEDOR}<br/>
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
        <div className="mt-2">Vuelto entregado: <b className="text-[#00f5d4]">${cobroGuardado(data).vuelto.toFixed(2)}</b> / Efectivo recibido: ${cobroGuardado(data).efectivoRecibido.toFixed(2)} / Entregado real: ${cobroGuardado(data).entregado.toFixed(2)}</div>
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