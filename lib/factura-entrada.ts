import { z } from "zod"

function numero(valor: unknown) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

const esquemaTexto = z.object({
  placa: z.string().regex(/^[A-Z0-9-]{0,8}$/, "La placa solo puede tener letras, números y guion"),
  email: z.string().email("El correo del cliente no es válido").or(z.literal("")),
  identificacion: z.string().regex(/^\d*$/, "La identificación solo puede tener dígitos"),
})

export function validarEntradaFactura(body: { placaVehiculo?: unknown; cliente?: { email?: unknown; identificacion?: unknown; tipoDoc?: unknown; tipoId?: unknown }; items?: unknown; totales?: Record<string, unknown> } | null) {
  const placa = String(body?.placaVehiculo || "").trim().toUpperCase()
  const email = String(body?.cliente?.email || "").trim()
  const id = String(body?.cliente?.identificacion || "").replace(/\s/g, "")
  const texto = esquemaTexto.safeParse({ placa, email, identificacion: id })
  if (!texto.success) return texto.error.issues[0]?.message || "Datos inválidos"
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
