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
}) {
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
  <div class="no-print" style="margin-bottom:12px"><button onclick="window.print()" style="background:#0284c7;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer">Imprimir</button></div>
  <div class="grid">
    <div>
      ${logo}
      <h1 style="font-size:14px;margin:0 0 6px;text-transform:uppercase">${esc(data.razonSocial)}</h1>
      <p style="margin:0 0 4px;color:#475569">${esc(data.nombreComercial)}</p>
      <p style="margin:0 0 4px"><b>Dirección Matriz:</b> ${esc(data.dirMatriz)}</p>
      <p style="margin:0 0 8px"><b>Dirección Sucursal:</b> ${esc(data.dirSucursal || data.dirMatriz)}</p>
      <p style="margin:0"><b>OBLIGADO A LLEVAR CONTABILIDAD:</b> ${esc(data.obligado || "NO")}</p>
      <p style="margin:0"><b>CONTRIBUYENTE RÉGIMEN:</b> ${esc(data.regimen || "—")}</p>
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
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px">
      <h3 style="margin:0 0 8px;font-size:11px;text-transform:uppercase">Información Adicional</h3>
      <p style="margin:0 0 4px"><b>Dirección:</b> ${esc(data.direccionCliente)}</p>
      <p style="margin:0 0 4px"><b>Email:</b> ${esc(data.email || "—")}</p>
      <p style="margin:0"><b>Forma de Pago:</b> ${esc(data.formaPago)}</p>
      ${data.mensajeSri ? `<p style="margin:8px 0 0"><b>Mensaje del SRI:</b> ${esc(data.mensajeSri)}</p>` : ""}
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
