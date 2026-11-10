function numero(valor: unknown) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

export function validarEntradaFactura(body: { placaVehiculo?: unknown; cliente?: { email?: unknown; identificacion?: unknown; tipoDoc?: unknown; tipoId?: unknown }; items?: unknown; totales?: Record<string, unknown> } | null) {
  const placa = String(body?.placaVehiculo || "").trim()
  if (placa && !/^[A-Z0-9-]{1,8}$/.test(placa)) return "La placa solo puede tener letras, números y guion"
  const email = String(body?.cliente?.email || "").trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "El correo del cliente no es válido"
  const id = String(body?.cliente?.identificacion || "").replace(/\s/g, "")
  if (id && !/^\d+$/.test(id)) return "La identificación solo puede tener dígitos"
  const tipo = String(body?.cliente?.tipoDoc || body?.cliente?.tipoId || "")
  if (tipo === "04" && id.length !== 13) return "El RUC debe tener 13 dígitos"
  if (tipo === "05" && id.length !== 10) return "La cédula debe tener 10 dígitos"
  const items = Array.isArray(body?.items) ? body.items : []
  for (const item of items as Array<Record<string, unknown>>) {
    const cant = numero(item?.cant ?? item?.cantidad)
    const precio = numero(item?.pUnit ?? item?.precioUnitario)
    const desc = numero(item?.descPorc ?? item?.descuento ?? 0)
    if (cant == null || cant < 0) return "La cantidad no puede ser negativa"
    if (precio == null || precio < 0) return "El precio no puede ser negativo"
    if (desc != null && desc < 0) return "El descuento no puede ser negativo"
  }
  const totales = body?.totales || {}
  for (const clave of ["bruto", "descuento", "subtotalSin", "iva15", "propina", "total"]) {
    if (totales[clave] == null || totales[clave] === "") continue
    const n = numero(totales[clave])
    if (n == null || n < 0) return "Los montos no pueden ser negativos"
  }
  return ""
}
