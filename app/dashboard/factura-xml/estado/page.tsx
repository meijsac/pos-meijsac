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
  const tipo = d?.tipo_cobro || d?.refs?.tipoCobro
  if (tipo === "PENDIENTE_DE_PAGO" || tipo === "CREDITO" || tipo === "pendiente" || tipo === "credito") {
    return { formaPago: pagos.formaPago || d?.formaPago || FORMA_PAGO_DEFECTO, entregado: 0, efectivoRecibido: 0, vuelto: 0 }
  }
  const caja = d?.caja || {}
  const sumaCaja = [caja.efectivo, caja.transfer, caja.tarjeta, caja.credito].reduce((s: number, v: unknown) => s + (numeroGuardado(v) ?? 0), 0)
  let entregado = numeroGuardado(d?.montoEntregado) ?? numeroGuardado(pagos.entregado)
  let vuelto = numeroGuardado(d?.vuelto) ?? numeroGuardado(pagos.vuelto) ?? numeroGuardado(pagos.cambio) ?? 0
  if (sumaCaja > 0) {
    entregado = Math.round(sumaCaja * 100) / 100
    vuelto = sumaCaja > total + 0.009 ? Math.round((sumaCaja - total) * 100) / 100 : 0
  } else if (entregado !== null && vuelto > 0 && Math.abs(entregado - vuelto) < 0.02) {
    entregado = Math.round((total + vuelto) * 100) / 100
  } else if (entregado === null || entregado + 0.009 < total) {
    entregado = total
    vuelto = 0
  }
  if (vuelto > 0 && entregado !== null && Math.abs(entregado - vuelto) < 0.02) {
    entregado = Math.round((total + vuelto) * 100) / 100
  }
  const formaPago = pagos.formaPago || d?.formaPago || FORMA_PAGO_DEFECTO
  return { formaPago, entregado: entregado ?? total, efectivoRecibido: entregado ?? total, vuelto }
}

function dinero(v: unknown) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function resumenContable(d: any) {
  const items: any[] = Array.isArray(d?.items) ? d.items : []
  const neto = (it: any) => (Number(it?.cant) || 0) * (Number(it?.pUnit) || 0) * (1 - (Number(it?.descPorc) || 0) / 100)
  const cod = (it: any) => String(it?.codigoPorcentaje ?? "")
  const suma = (codigos: string[]) => items.filter((it) => codigos.includes(cod(it))).reduce((s, it) => s + neto(it), 0)
  const t = d?.totales || {}
  const subtotalSin = dinero(t.subtotalSin) ?? items.reduce((s, it) => s + neto(it), 0)
  const base15 = dinero(t.base15) ?? suma(["4"])
  const base0 = dinero(t.base0) ?? suma(["0"])
  const baseNoObjeto = dinero(t.baseNoObjeto) ?? suma(["6"])
  const baseExento = dinero(t.baseExento) ?? suma(["7"])
  const baseDiferenciado = dinero(t.baseDiferenciado) ?? suma(["10", "5", "8", "2", "3"])
  const descuento = dinero(t.descuento) ?? items.reduce((s, it) => s + (Number(it?.cant) || 0) * (Number(it?.pUnit) || 0) * ((Number(it?.descPorc) || 0) / 100), 0)
  const ice = dinero(t.valorICE) ?? items.reduce((s, it) => s + (Number(it?.ice) || 0), 0)
  const irbpnr = dinero(t.valorIRBPNR) ?? items.filter((it) => it?.esPlastico).reduce((s, it) => s + (Number(it?.cant) || 0) * 0.02, 0)
  const iva = dinero(t.iva15) ?? Math.round(base15 * 0.15 * 100) / 100
  const propina = dinero(t.propina) ?? 0
  const total = dinero(t.total) ?? Math.round((subtotalSin + iva + (dinero(t.ivaDiferenciado) ?? 0) + ice + irbpnr + propina) * 100) / 100
  return { subtotalSin, base15, base0, baseNoObjeto, baseExento, baseDiferenciado, descuento, ice, irbpnr, iva, propina, total }
}

function htmlResumen(d: any) {
  const r = resumenContable(d)
  const usd = (n: number) => `$${n.toFixed(2)}`
  const filas: [string, string][] = [
    ["Subtotal sin Impuestos:", usd(r.subtotalSin)],
    ["Subtotal IVA 15% (o vig.):", usd(r.base15)],
    ["Subtotal IVA 0%:", usd(r.base0)],
    ["Subtotal No objeto de IVA:", usd(r.baseNoObjeto)],
    ["Subtotal Exento de IVA:", usd(r.baseExento)],
    ["Subtotal IVA Diferenciado:", usd(r.baseDiferenciado)],
    ["Total Descuentos:", usd(r.descuento)],
    ["Valor ICE:", usd(r.ice)],
    ["Valor IRBPNR (Plásticos):", usd(r.irbpnr)],
    ["IVA Oficial:", usd(r.iva)],
    ["Propina 10%:", usd(r.propina)],
    ["VALOR TOTAL A PAGAR:", usd(r.total)],
  ]
  return { filas, total: r.total }
}

export default function EstadoSRI(){
  const router = useRouter()
  const [estado, setEstado] = useState<"PROCESANDO"|"AUTORIZADO"|"PENDIENTE">("PROCESANDO")
  const [data, setData] = useState<any>({})
  const [modoNegocio, setModoNegocio] = useState("GENERAL")

  useEffect(()=>{
    const factura = JSON.parse(localStorage.getItem("meijsac_ultima_factura_pendiente")||"{}")
    let modo = factura.modo_negocio === "RESTAURANTE" ? "RESTAURANTE" : "GENERAL"
    if (!factura.modo_negocio) {
      try {
        const cfg = JSON.parse(localStorage.getItem("meijsac_config") || "{}")
        const rest = JSON.parse(localStorage.getItem("meijsac_config_restaurante") || "{}")
        const empresa = JSON.parse(localStorage.getItem("meijsac_empresa") || "{}")
        const marca = cfg.modo_negocio || cfg.tipoNegocio || rest.modo_negocio || rest.tipoNegocio || empresa.modo_negocio
        if (marca === "restaurante" || marca === "RESTAURANTE") modo = "RESTAURANTE"
      } catch {}
    }
    setModoNegocio(modo)
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
    const avisoCobro = (doc: any, monto: number | null) => {
      const saldo = usd(monto || 0)
      if (doc?.tipo_cobro === "PENDIENTE_DE_PAGO") return `<div style="font-size:14px;font-weight:900;margin:4px 0">PENDIENTE DE PAGO - Saldo Pendiente ${saldo}</div>`
      if (doc?.tipo_cobro === "CREDITO") {
        const vence = doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento).toLocaleDateString("es-EC") : ""
        return `<div style="font-size:13px;font-weight:900;margin:4px 0">CRÉDITO - Plazo: ${doc.plazo} ${doc.unidad_plazo}, Cuotas: ${doc.cuotas}, Vence: ${vence}, Saldo Pendiente ${saldo}</div>`
      }
      return ""
    }
    const bloqueTransferencia = (doc: any) => {
      let cfg: any = {}
      try { cfg = JSON.parse(localStorage.getItem("meijsac_config_pro") || "{}") } catch { cfg = {} }
      const datos = doc?.configEmisor?.datosTransferencia || cfg.datosTransferencia || cfg.transferencia
      const activo = doc?.configEmisor?.datosTransferenciaActivo || cfg.datosTransferenciaActivo || cfg.transferenciaActiva || datos?.activo
      if (!activo || !datos) return ""
      return `<div class="borde" style="margin-top:3mm"><b>Datos para Transferencia</b><div>${datos.banco || ""} ${datos.tipoCuenta || ""} ${datos.cuenta || datos.numero || ""}</div><div>${datos.titular || ""} ${datos.identificacion || ""}</div></div>`
    }
    const cobro = cobroGuardado(d)
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
        ${d.configEmisor?.logo ? `<img src="${d.configEmisor.logo}" alt="" style="width:120px;height:auto;object-fit:contain;display:block;margin-bottom:2mm"/>` : ""}
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
        <b>RESUMEN CONTABLE FACTURA (SRI)</b>
        ${htmlResumen(d).filas.map(([nombre, valor]) => `<div class="linea${nombre.startsWith("VALOR") ? " total" : ""}"><span>${nombre}</span><b>${valor}</b></div>`).join("")}
        <div class="pagos">
          ${avisoCobro(d, total)}
          <div><b>FORMAS DE PAGO (Tabla 24)</b></div>
          <div class="pago">${cobro.formaPago} ${usd(d?.tipo_cobro === "PENDIENTE_DE_PAGO" || d?.tipo_cobro === "CREDITO" ? 0 : total!)}</div>
          <div class="pago">ENTREGADO: ${usd(cobro.entregado)}</div>
          <div class="vuelto">VUELTO: ${usd(cobro.vuelto)}</div>
        </div>
        ${d?.tipo_cobro === "PENDIENTE_DE_PAGO" ? bloqueTransferencia(d) : ""}
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
    const formaPagoTxt = cobro.formaPago
    const html = `
    <html><head><title>TICKET</title>
    <style>@page{size:80mm auto;margin:2mm} body{width:80mm;font-family:monospace;font-size:11px;color:#000}.c{text-align:center}.b{font-weight:900}.line{border-top:1px dashed #000;margin:4px 0}</style>
    </head><body>
    ${d.configEmisor?.logo ? `<div class="c"><img src="${d.configEmisor.logo}" alt="" style="width:60mm;max-width:60mm;height:auto;object-fit:contain"/></div>` : ""}
    <div class="c b">${d.configEmisor?.comercial || ""}</div>
    <div class="c">${d.configEmisor?.razon || ""}</div>
    <div class="c">RUC: ${d.configEmisor?.ruc || ""}</div>
    <div class="c" style="font-size:9px">${d.configEmisor?.sucursal || ""}<br/>Obligado a llevar contabilidad: ${d.configEmisor?.obligado || ""} - ${d.configEmisor?.regimen || ""}</div>
    <div class="line"></div>
    <div>FACT: ${d.establecimiento}-${d.secuencial}</div>
    <div style="font-size:7px;word-break:break-all">CLAVE: ${d.claveAcceso}</div>
    <div>EMISION: NORMAL</div>
    <div>Cliente: ${d.cliente?.razon}</div>
    <div>RUC/CI: ${d.cliente?.identificacion}</div>
    <div class="line"></div>
    ${(d.items||[]).map((it:any)=>`<div>${it.cant} x ${it.descripcion}<br/>P.Unit $${it.pUnit?.toFixed(2)} = $${(it.cant*it.pUnit).toFixed(2)}</div>`).join("")}
    <div class="line"></div>
    <div class="b">RESUMEN CONTABLE FACTURA (SRI)</div>
    ${htmlResumen(d).filas.map(([nombre, valor]) => `<div${nombre.startsWith("VALOR") ? ' class="b"' : ""}>${nombre} ${valor}</div>`).join("")}
    <div class="line"></div>
    <div>FORMA PAGO: ${formaPagoTxt} $${d?.tipo_cobro === "PENDIENTE_DE_PAGO" || d?.tipo_cobro === "CREDITO" ? "0.00" : Number(d.totales?.total || 0).toFixed(2)}</div>
    ${d?.tipo_cobro === "PENDIENTE_DE_PAGO" ? `<div class="b">PENDIENTE DE PAGO - Saldo Pendiente $${Number(d.totales?.total || 0).toFixed(2)}</div>` : ""}
    ${d?.tipo_cobro === "CREDITO" ? `<div class="b">CRÉDITO - Plazo: ${d.plazo} ${d.unidad_plazo}, Cuotas: ${d.cuotas}, Vence: ${d.fecha_vencimiento ? new Date(d.fecha_vencimiento).toLocaleDateString("es-EC") : ""}, Saldo Pendiente $${Number(d.totales?.total || 0).toFixed(2)}</div>` : ""}
    <div>ENTREGADO: $${entregado.toFixed(2)}</div>
    <div class="b" style="background:#000;color:#fff;padding:4px;font-size:13px">VUELTO: $${cambio.toFixed(2)}</div>
    <div>EFECTIVO EN CAJA: $${entregado.toFixed(2)}</div>
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
        <span className="text-[10px] bg-white text-black px-2 py-1 rounded-full uppercase">{modoNegocio}</span>
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
        {modoNegocio === "RESTAURANTE" ? (
          <button onClick={()=> liberarMesaYVolver("/dashboard/restaurante")} className="w-full bg-black border border-white/20 p-4 rounded-xl font-black">VOLVER A MESAS - {data.mesaNombre || "MESA"}</button>
        ) : (
          <button onClick={()=> router.push("/dashboard/factura-xml")} className="w-full bg-black border border-white/20 p-4 rounded-xl font-black">VOLVER A FACTURA</button>
        )}
        <button onClick={()=> router.push("/dashboard")} className="w-full bg-white/5 text-white/40 p-3 rounded-xl text-[11px] font-bold">← DASHBOARD</button>
      </div>
    </div>
  )
}