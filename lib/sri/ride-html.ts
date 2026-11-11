function esc(valor: unknown) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function dinero(valor: unknown) {
  const n = Number(valor)
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

const CODE128 = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
]

function barrasCode128(texto: string) {
  const limpio = texto.replace(/\D/g, "")
  if (!limpio) return ""
  const valores = [104]
  for (const char of limpio) valores.push(char.charCodeAt(0) - 32)
  const suma = valores.reduce((total, valor, i) => total + valor * (i === 0 ? 1 : i), 0)
  valores.push(suma % 103)
  valores.push(106)
  const bits = valores.map((v) => CODE128[v] || "").join("")
  const alto = 46
  const ancho = bits.length
  let x = 0
  let barras = ""
  for (let i = 0; i < bits.length; i++) {
    const w = Number(bits[i])
    if (i % 2 === 0) barras += `<rect x="${x}" y="0" width="${w}" height="${alto}" fill="#0f172a"/>`
    x += w
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="100%" height="46" role="img" aria-label="Código de barras">${barras}</svg>`
}

export function htmlRide(data: {
  razonSocial: string
  nombreComercial: string
  ruc: string
  dirMatriz: string
  dirSucursal: string
  obligado: string
  regimen: string
  logoUrl: string
  numeroFactura: string
  claveAcceso: string
  fechaAutorizacion: string
  ambiente: string
  cliente: string
  identificacion: string
  fechaEmision: string
  email: string
  direccionCliente: string
  formaPago: string
  items: Array<{ codigo?: string; descripcion?: string; cant?: number; pUnit?: number; descDolar?: number; descPorc?: number; total?: number }>
  base15: number
  base0: number
  baseNoObjeto: number
  baseExento: number
  subtotalSin: number
  descuento: number
  ice: number
  iva: number
  propina: number
  total: number
  mensajeSri?: string
  xmlUrl?: string
  vuelto?: number
  recibido?: number
}) {
  const leyendaRegimen = (() => {
    const texto = String(data.regimen || "").toUpperCase()
    if (texto.includes("POPULAR")) return "CONTRIBUYENTE RÉGIMEN RIMPE: NEGOCIO POPULAR"
    if (texto.includes("RIMPE") || texto.includes("EMPRENDEDOR")) return "CONTRIBUYENTE RÉGIMEN RIMPE: EMPRENDEDOR"
    return ""
  })()
  const filas = (data.items || []).map((item) => {
    const cant = Number(item.cant || 0)
    const precio = Number(item.pUnit || 0)
    const desc = Number(item.descDolar || 0) || cant * precio * Number(item.descPorc || 0) / 100
    const total = Number.isFinite(Number(item.total)) ? Number(item.total) : cant * precio - desc
    return `<tr>
      <td style="padding:8px;text-align:center;font-family:monospace;color:#64748b">${esc(item.codigo || "")}</td>
      <td style="padding:8px;text-align:center">${cant.toFixed(2)}</td>
      <td style="padding:8px;font-weight:600">${esc(item.descripcion || "")}</td>
      <td style="padding:8px;text-align:right;font-family:monospace">${dinero(precio)}</td>
      <td style="padding:8px;text-align:right;font-family:monospace">${dinero(desc)}</td>
      <td style="padding:8px;text-align:right;font-family:monospace;font-weight:700">${dinero(total)}</td>
    </tr>`
  }).join("")
  const clave = String(data.claveAcceso || "").replace(/\D/g, "")
  const barras = barrasCode128(clave)
  const fechaAutorizacion = String(data.fechaAutorizacion || "").trim()
  const logo = data.logoUrl ? `<img src="${esc(data.logoUrl)}" alt="Logotipo" style="max-height:80px;max-width:220px;object-fit:contain;margin-bottom:12px">` : ""
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>RIDE ${esc(data.numeroFactura)}</title>
  <style>
    body { background:#fff; color:#1e293b; font-family:Arial,sans-serif; padding:24px; max-width:900px; margin:0 auto; font-size:12px; line-height:1.4; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
    .caja { border:1px solid #cbd5e1; border-radius:8px; padding:16px; background:#f8fafc; }
    table { width:100%; border-collapse:collapse; }
    th { background:#f1f5f9; text-align:left; padding:8px; border-bottom:1px solid #e2e8f0; }
    .tot { display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #f1f5f9; }
    .total { display:flex; justify-content:space-between; padding:10px; background:#f0f9ff; border-top:2px solid #0284c7; font-weight:700; font-size:14px; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .no-print { display:none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:12px;display:flex;gap:8px">
    <button onclick="window.print()" style="background:#0284c7;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer">Imprimir</button>
    ${data.xmlUrl ? `<a href="${esc(data.xmlUrl)}" style="background:#0f172a;color:#fff;border-radius:8px;padding:10px 16px;font-weight:700;text-decoration:none">Descargar XML</a>` : ""}
  </div>
  <div class="grid">
    <div>
      ${logo}
      <h1 style="font-size:14px;margin:0 0 6px;text-transform:uppercase">${esc(data.razonSocial)}</h1>
      <p style="margin:0 0 4px;color:#475569">${esc(data.nombreComercial)}</p>
      <p style="margin:0 0 4px"><b>Dirección Matriz:</b> ${esc(data.dirMatriz)}</p>
      <p style="margin:0 0 8px"><b>Dirección Sucursal:</b> ${esc(data.dirSucursal || data.dirMatriz)}</p>
      <p style="margin:0"><b>OBLIGADO A LLEVAR CONTABILIDAD:</b> ${esc(data.obligado || "NO")}</p>
      ${leyendaRegimen ? `<p style="margin:0"><b>${esc(leyendaRegimen)}</b></p>` : ""}
    </div>
    <div class="caja">
      <p style="font-size:14px;font-weight:700;margin:0">R.U.C.: <span style="font-weight:400">${esc(data.ruc)}</span></p>
      <h2 style="font-size:18px;color:#0369a1;margin:6px 0">FACTURA</h2>
      <p style="font-weight:700;margin:0 0 8px">No. <span style="font-family:monospace;font-weight:400">${esc(data.numeroFactura)}</span></p>
      <p style="font-weight:700;margin:8px 0 0">NÚMERO DE AUTORIZACIÓN:</p>
      <p style="font-family:monospace;font-size:11px;word-break:break-all;margin:0">${esc(clave)}</p>
      <p style="margin:8px 0 0"><b>FECHA Y HORA DE AUTORIZACIÓN:</b> ${esc(fechaAutorizacion || "—")}</p>
      <p style="margin:0"><b>AMBIENTE:</b> ${esc(data.ambiente)}</p>
      <p style="margin:0"><b>EMISIÓN:</b> NORMAL</p>
      <p style="font-weight:700;margin:10px 0 4px">CLAVE DE ACCESO:</p>
      ${barras}
      <p style="font-family:monospace;font-size:10px;color:#64748b;margin:4px 0 0">${esc(clave)}</p>
    </div>
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <p style="margin:0"><b>Razón Social / Nombres y Apellidos:</b> ${esc(data.cliente)}</p>
    <p style="margin:0"><b>Identificación:</b> <span style="font-family:monospace">${esc(data.identificacion)}</span></p>
    <p style="margin:0"><b>Fecha de Emisión:</b> ${esc(data.fechaEmision)}</p>
    <p style="margin:0"><b>Guía de Remisión:</b> S/N</p>
    <p style="margin:0"><b>Dirección:</b> ${esc(data.direccionCliente || "—")}</p>
    <p style="margin:0"><b>Email:</b> ${esc(data.email || "—")}</p>
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px">
    <table>
      <thead>
        <tr>
          <th style="text-align:center">Cod. Principal</th>
          <th style="text-align:center">Cant.</th>
          <th>Descripción</th>
          <th style="text-align:right">Precio Unitario</th>
          <th style="text-align:right">Descuento</th>
          <th style="text-align:right">Precio Total</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  </div>
  <div class="grid">
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;display:flex;flex-direction:column;height:100%">
      <div>
        <h3 style="margin:0 0 8px;font-size:11px;text-transform:uppercase">Información Adicional</h3>
        <p style="margin:0"><b>Forma de Pago:</b> ${esc(data.formaPago)}</p>
        ${Number(data.recibido) > 0 ? `<p style="margin:4px 0 0"><b>Valor recibido:</b> ${dinero(data.recibido)}</p>` : ""}
        ${Number(data.vuelto) > 0 ? `<p style="margin:4px 0 0"><b>Vuelto entregado:</b> ${dinero(data.vuelto)}</p>` : ""}
        ${data.mensajeSri ? `<p style="margin:8px 0 0"><b>Mensaje del SRI:</b> ${esc(data.mensajeSri)}</p>` : ""}
      </div>
      <p style="margin:16px 0 0;margin-top:auto"><b>Proveedor del sistema:</b> MEIJSAC S.A.S. RUC 1793243789001</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-family:monospace">
      <div class="tot"><span style="font-family:Arial">SUBTOTAL 15%</span><span>${dinero(data.base15)}</span></div>
      <div class="tot"><span style="font-family:Arial">SUBTOTAL 0%</span><span>${dinero(data.base0)}</span></div>
      <div class="tot"><span style="font-family:Arial">SUBTOTAL NO OBJETO DE IVA</span><span>${dinero(data.baseNoObjeto)}</span></div>
      <div class="tot"><span style="font-family:Arial">SUBTOTAL EXENTO DE IVA</span><span>${dinero(data.baseExento)}</span></div>
      <div class="tot"><span style="font-family:Arial;font-weight:700">SUBTOTAL SIN IMPUESTOS</span><span>${dinero(data.subtotalSin)}</span></div>
      <div class="tot"><span style="font-family:Arial">TOTAL DESCUENTO</span><span>${dinero(data.descuento)}</span></div>
      <div class="tot"><span style="font-family:Arial">ICE</span><span>${dinero(data.ice)}</span></div>
      <div class="tot"><span style="font-family:Arial">IVA 15%</span><span>${dinero(data.iva)}</span></div>
      <div class="tot"><span style="font-family:Arial">PROPINA</span><span>${dinero(data.propina)}</span></div>
      <div class="total"><span style="font-family:Arial">VALOR TOTAL</span><span>${dinero(data.total)}</span></div>
    </div>
  </div>
</body>
</html>`
}

export function htmlTicket(data: Parameters<typeof htmlRide>[0]) {
  const filas = (data.items || []).map((item) => {
    const cant = Number(item.cant || 0)
    const precio = Number(item.pUnit || 0)
    const desc = Number(item.descDolar || 0) || cant * precio * Number(item.descPorc || 0) / 100
    const total = Number.isFinite(Number(item.total)) ? Number(item.total) : cant * precio - desc
    return `<tr>
      <td style="text-align:left;padding:2px 0;text-transform:uppercase">${esc(item.descripcion || "")}</td>
      <td style="text-align:center;padding:2px 0">${cant.toFixed(2)}</td>
      <td style="text-align:right;padding:2px 0">${dinero(total)}</td>
    </tr>`
  }).join("")
  const leyendaRegimen = (() => {
    const texto = String(data.regimen || "").toUpperCase()
    if (texto.includes("POPULAR")) return "RÉGIMEN RIMPE: NEGOCIO POPULAR"
    if (texto.includes("RIMPE") || texto.includes("EMPRENDEDOR")) return "RÉGIMEN RIMPE: EMPRENDEDOR"
    return ""
  })()
  const clave = String(data.claveAcceso || "").replace(/\D/g, "")
  const recibido = Number(data.recibido || 0)
  const vuelto = Number(data.vuelto || 0)
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${esc(data.numeroFactura)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body { width: 80mm; margin: 0; padding: 2mm; font-family: monospace; font-size: 11px; background: #fff; color: #000; }
    hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:6px"><button onclick="window.print()">Imprimir ticket</button></div>
  <div style="text-align:center;text-transform:uppercase;font-weight:bold">${esc(data.razonSocial)}</div>
  ${data.nombreComercial ? `<p style="text-align:center;margin:2px 0;text-transform:uppercase;font-weight:600">${esc(data.nombreComercial)}</p>` : ""}
  <p style="text-align:center;margin:2px 0;font-weight:bold">R.U.C.: ${esc(data.ruc)}</p>
  <p style="text-align:center;margin:2px 0">Matriz: ${esc(data.dirMatriz || "—")}</p>
  <p style="text-align:center;margin:2px 0;font-size:9px">OBLIGADO A LLEVAR CONTABILIDAD: ${esc(data.obligado || "NO")}</p>
  ${leyendaRegimen ? `<p style="text-align:center;margin:2px 0;font-size:9px">${esc(leyendaRegimen)}</p>` : ""}
  <hr>
  <p style="margin:2px 0;font-weight:bold">FACTURA No: <span style="font-weight:normal">${esc(data.numeroFactura)}</span></p>
  <p style="margin:2px 0"><b>FECHA EMISIÓN:</b> ${esc(data.fechaEmision)}</p>
  <p style="margin:2px 0;text-transform:uppercase"><b>CLIENTE:</b> ${esc(data.cliente)}</p>
  <p style="margin:2px 0"><b>RUC/CÍ:</b> ${esc(data.identificacion)}</p>
  <hr>
  <table>
    <thead>
      <tr style="border-bottom:1px solid #000">
        <th style="text-align:left">DESCRIPCIÓN</th>
        <th style="text-align:center">CANT</th>
        <th style="text-align:right">TOTAL</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <hr>
  <div style="text-align:right">
    <p style="margin:2px 0">SUBTOTAL 15%: ${dinero(data.base15)}</p>
    <p style="margin:2px 0">SUBTOTAL 0%: ${dinero(data.base0)}</p>
    <p style="margin:2px 0">SUBTOTAL SIN IMPUESTOS: ${dinero(data.subtotalSin)}</p>
    <p style="margin:2px 0">TOTAL DESCUENTO: ${dinero(data.descuento)}</p>
    <p style="margin:2px 0">IVA 15%: ${dinero(data.iva)}</p>
    <p style="margin:4px 0;font-weight:bold;border-top:1px solid #000">TOTAL A PAGAR: ${dinero(data.total)}</p>
  </div>
  <hr>
  <p style="margin:2px 0;font-weight:bold">Detalle de Cobro:</p>
  <p style="margin:2px 0">${esc(data.formaPago)}</p>
  ${recibido > 0 ? `<p style="margin:2px 0;font-weight:bold">VALOR RECIBIDO: ${dinero(recibido)}</p>` : ""}
  ${vuelto > 0 ? `<p style="margin:2px 0;font-weight:bold">VUELTO ENTREGADO: ${dinero(vuelto)}</p>` : ""}
  <hr>
  <p style="margin:2px 0;font-weight:bold">AMBIENTE: <span style="font-weight:normal">${esc(data.ambiente || "PRUEBAS")}</span></p>
  <p style="margin:2px 0;font-weight:bold">EMISIÓN: <span style="font-weight:normal">NORMAL</span></p>
  <p style="margin:6px 0 2px;font-weight:bold">CLAVE DE ACCESO / NÚMERO DE AUTORIZACIÓN:</p>
  ${barrasCode128(clave)}
  <p style="font-size:8px;word-break:break-all;margin:4px 0">${esc(clave)}</p>
  <p style="text-align:center;margin:8px 0 0;font-style:italic">¡Gracias por su pago${data.nombreComercial ? ` en ${esc(data.nombreComercial)}` : ""}!</p>
  <p style="text-align:center;margin:4px 0 0;font-size:9px">Proveedor del sistema: MEIJSAC S.A.S. RUC 1793243789001</p>
</body>
</html>`
}

type DestinoGuia = {
  identificacion?: string
  razon?: string
  direccion?: string
  motivo?: string
  documento?: string
  numero?: string
  fecha?: string
  productos?: Array<{ codigo?: string; descripcion?: string; cantidad?: number }>
}

function bloquesGuia(destinos: DestinoGuia[]) {
  return (destinos || []).map((dest, indice) => {
    const filas = (dest.productos || []).map((item) => `<tr>
      <td style="padding:6px;font-family:monospace">${esc(item.codigo || "")}</td>
      <td style="padding:6px">${esc(item.descripcion || "")}</td>
      <td style="padding:6px;text-align:right;font-family:monospace">${Number(item.cantidad || 0).toFixed(2)}</td>
    </tr>`).join("")
    return `<section style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px;overflow:hidden">
      <div style="background:#f8fafc;padding:10px 12px">
        <p style="margin:0;font-weight:700">Destinatario ${indice + 1}: ${esc(dest.razon || "")}</p>
        <p style="margin:4px 0 0">Identificación: <span style="font-family:monospace">${esc(dest.identificacion || "")}</span></p>
        <p style="margin:2px 0 0">Dirección: ${esc(dest.direccion || "")}</p>
        <p style="margin:2px 0 0">Motivo: ${esc(dest.motivo || "")}</p>
        <p style="margin:2px 0 0">Sustento ${esc(dest.documento || "Factura")}: <span style="font-family:monospace">${esc(dest.numero || "")}</span> · ${esc(dest.fecha || "")}</p>
      </div>
      <table>
        <thead><tr><th>Código</th><th>Descripción</th><th style="text-align:right">Cantidad</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </section>`
  }).join("")
}

export function htmlGuiaRemision(data: {
  razonSocial: string
  nombreComercial: string
  ruc: string
  dirMatriz: string
  obligado: string
  regimen: string
  numero: string
  claveAcceso: string
  fechaAutorizacion: string
  ambiente: string
  fechaEmision: string
  transportista: string
  identificacionTransportista: string
  placa: string
  partida: string
  inicio: string
  fin: string
  destinatarios: DestinoGuia[]
  xmlUrl?: string
}) {
  const texto = String(data.regimen || "").toUpperCase()
  const leyenda = texto.includes("POPULAR")
    ? "CONTRIBUYENTE RÉGIMEN RIMPE: NEGOCIO POPULAR"
    : (texto.includes("RIMPE") || texto.includes("EMPRENDEDOR") ? "CONTRIBUYENTE RÉGIMEN RIMPE: EMPRENDEDOR" : "")
  const clave = String(data.claveAcceso || "").replace(/\D/g, "")
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Guía ${esc(data.numero)}</title>
  <style>body{background:#fff;color:#1e293b;font-family:Arial,sans-serif;padding:24px;max-width:900px;margin:0 auto;font-size:12px}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;text-align:left;padding:6px;border-bottom:1px solid #e2e8f0}@media print{.no-print{display:none}}</style></head><body>
  <div class="no-print" style="margin-bottom:12px;display:flex;gap:8px"><button onclick="window.print()" style="background:#0f766e;color:#042f2e;border:0;border-radius:8px;padding:10px 16px;font-weight:700">Imprimir</button>${data.xmlUrl ? `<a href="${esc(data.xmlUrl)}" style="background:#0f172a;color:#fff;border-radius:8px;padding:10px 16px;font-weight:700;text-decoration:none">Descargar XML</a>` : ""}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div><h1 style="font-size:14px;margin:0 0 6px">${esc(data.razonSocial)}</h1><p style="margin:0">${esc(data.nombreComercial)}</p><p style="margin:4px 0"><b>Dirección matriz:</b> ${esc(data.dirMatriz)}</p><p style="margin:0"><b>Obligado a llevar contabilidad:</b> ${esc(data.obligado || "NO")}</p>${leyenda ? `<p style="margin:0"><b>${esc(leyenda)}</b></p>` : ""}</div>
    <div style="border:1px solid #cbd5e1;border-radius:8px;padding:12px;background:#f8fafc"><p style="margin:0"><b>R.U.C.:</b> ${esc(data.ruc)}</p><h2 style="color:#0f766e;margin:6px 0">GUÍA DE REMISIÓN</h2><p style="margin:0"><b>No.</b> <span style="font-family:monospace">${esc(data.numero)}</span></p><p style="margin:8px 0 0"><b>Autorización:</b></p><p style="font-family:monospace;word-break:break-all;margin:0">${esc(clave)}</p>${barrasCode128(clave)}<p style="margin:6px 0 0"><b>Fecha de autorización:</b> ${esc(data.fechaAutorizacion || "—")}</p><p style="margin:0"><b>Ambiente:</b> ${esc(data.ambiente)}</p><p style="margin:0"><b>Emisión:</b> ${esc(data.fechaEmision)}</p></div>
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px"><p style="margin:0"><b>Transportista:</b> ${esc(data.transportista)} · ${esc(data.identificacionTransportista)}</p><p style="margin:4px 0 0"><b>Placa:</b> ${esc(data.placa)}</p><p style="margin:4px 0 0"><b>Partida:</b> ${esc(data.partida)}</p><p style="margin:4px 0 0"><b>Traslado:</b> ${esc(data.inicio)} al ${esc(data.fin)}</p></div>
  ${bloquesGuia(data.destinatarios)}
  <p style="margin:16px 0 0"><b>Proveedor del sistema:</b> MEIJSAC S.A.S. RUC 1793243789001</p>
  </body></html>`
}

export function htmlGuiaTicket(data: {
  razonSocial: string
  nombreComercial: string
  ruc: string
  numero: string
  claveAcceso: string
  fechaAutorizacion: string
  ambiente: string
  transportista: string
  placa: string
  inicio: string
  fin: string
  destinatarios: DestinoGuia[]
}) {
  const clave = String(data.claveAcceso || "").replace(/\D/g, "")
  const destinos = (data.destinatarios || []).map((dest) => {
    const lineas = (dest.productos || []).map((item) => `<p style="margin:1px 0">${esc(item.descripcion || "")} · ${Number(item.cantidad || 0).toFixed(2)}</p>`).join("")
    return `<p style="margin:6px 0 0;font-weight:700">${esc(dest.razon || "")}</p><p style="margin:0">${esc(dest.numero || "")}</p>${lineas}`
  }).join("")
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Guía ${esc(data.numero)}</title></head>
  <body style="font-family:Arial,sans-serif;width:80mm;margin:0 auto;font-size:11px;color:#000">
  <p style="text-align:center;font-weight:700;margin:0">${esc(data.nombreComercial || data.razonSocial)}</p>
  <p style="text-align:center;margin:2px 0">${esc(data.razonSocial)}</p>
  <p style="text-align:center;margin:2px 0">RUC ${esc(data.ruc)}</p>
  <p style="text-align:center;font-weight:700;margin:6px 0">GUÍA DE REMISIÓN</p>
  <p style="text-align:center;font-family:monospace;margin:0">${esc(data.numero)}</p>
  <p style="margin:6px 0 0"><b>Transportista:</b> ${esc(data.transportista)}</p>
  <p style="margin:0"><b>Placa:</b> ${esc(data.placa)}</p>
  <p style="margin:0"><b>Traslado:</b> ${esc(data.inicio)} al ${esc(data.fin)}</p>
  ${destinos}
  <p style="margin:8px 0 0;font-weight:700">AMBIENTE: ${esc(data.ambiente)}</p>
  ${barrasCode128(clave)}
  <p style="font-size:8px;word-break:break-all">${esc(clave)}</p>
  <p style="margin:0">Autorización: ${esc(data.fechaAutorizacion || "—")}</p>
  <p style="text-align:center;font-size:9px">Proveedor del sistema: MEIJSAC S.A.S. RUC 1793243789001</p>
  </body></html>`
}
