export type CobroDoc = {
  tipo_cobro?: string
  estado_pago?: string
  fecha_vencimiento?: string
  facturaId?: string
  secuencial?: string
}

export function venceCobro(valor?: string) {
  if (!valor) return ""
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleDateString("es-EC")
}

export function etiquetaCobro(d: CobroDoc) {
  if (d.estado_pago === "PAGADO") return { clave: "pagado", texto: "PAGADO", clase: "bg-emerald-500/20 text-emerald-300" }
  if (d.tipo_cobro === "CREDITO" || String(d.estado_pago || "").includes("CRÉDITO")) {
    return { clave: "credito", texto: `CRÉDITO - Vence ${venceCobro(d.fecha_vencimiento)}`, clase: "bg-violet-500/20 text-violet-200" }
  }
  if (d.tipo_cobro === "PENDIENTE_DE_PAGO" || d.estado_pago === "PENDIENTE DE PAGO") {
    return { clave: "pendiente", texto: "PENDIENTE DE PAGO", clase: "bg-amber-400/20 text-amber-200" }
  }
  return { clave: "pagado", texto: "PAGADO", clase: "bg-emerald-500/20 text-emerald-300" }
}

export function pasaFiltroCobro(d: CobroDoc, filtro: string) {
  if (!filtro || filtro === "todos") return true
  return etiquetaCobro(d).clave === filtro
}

const LISTAS = ["meijsac_comprobantes_sri", "meijsac_comprobantes_emitidos", "meijsac_documentos_emitidos", "meijsac_facturas", "meijsac_retenciones", "meijsac_ventas_pos", "meijsac_restaurante_facturas", "meijsac_enviados_sri", "meijsac_comprobantes_pendientes_sri"]

export function marcarPagadoLocal(doc: CobroDoc) {
  LISTAS.forEach((clave) => {
    const lista = JSON.parse(localStorage.getItem(clave) || "[]")
    if (!Array.isArray(lista)) return
    localStorage.setItem(clave, JSON.stringify(lista.map((d: any) => {
      const sec = d.secuencial || (d.establecimiento && d.secuencial ? `${d.establecimiento}-${d.secuencial}` : "")
      if (sec === doc.secuencial || d.facturaId === doc.facturaId || d.id === doc.facturaId) return { ...d, estado_pago: "PAGADO", saldo_pendiente: 0 }
      return d
    })))
  })
}
