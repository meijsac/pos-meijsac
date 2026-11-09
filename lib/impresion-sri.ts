export const PIE_PROVEEDOR = "Proveedor del Sistema: MEIJSAC S.A.S. - RUC: 1793243789001."

export function usd(valor: unknown) {
  const n = typeof valor === "number" ? valor : Number(valor)
  if (!Number.isFinite(n)) return "$0.00"
  return `$${n.toFixed(2)}`
}

export const CSS_RIDE = `
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:10px}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  td,th{border:1px solid #000;padding:4px;font-size:10px;word-wrap:break-word;overflow-wrap:anywhere;vertical-align:top}
  .bloque,.borde{border:1px solid #000;padding:8px;word-wrap:break-word;overflow-wrap:anywhere}
  .sinborde td{border:none;vertical-align:top;padding:0 6px 0 0}
`

export const CSS_TICKET = `
  @page{size:80mm auto;margin:2mm}
  *{box-sizing:border-box}
  html,body{width:76mm;max-width:76mm;margin:0;padding:0;font-family:monospace;font-size:11px;color:#000}
  .c{text-align:center}
  .b{font-weight:900}
  .line{border-top:1px dashed #000;margin:4px 0}
  .row{display:flex;justify-content:space-between;align-items:flex-start;gap:6px}
  .nombre{flex:1;min-width:0;white-space:normal;word-break:break-word}
  .monto{white-space:nowrap;text-align:right}
`
