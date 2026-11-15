import { prisma } from "@/lib/prisma"

function tres(valor: unknown) {
  return String(valor ?? "").replace(/\D/g, "").padStart(3, "0").slice(-3)
}

export async function asegurarPunto(empresaId: string, estab: unknown, pto: unknown, nombre = "", direccion = "") {
  const codigoEstab = tres(estab)
  const codigoPto = tres(pto)
  if (!empresaId || codigoEstab === "000" || codigoPto === "000") return null
  const establecimiento = await prisma.establecimientoSri.upsert({
    where: { empresaId_codigo: { empresaId, codigo: codigoEstab } },
    create: { empresaId, codigo: codigoEstab, nombre: nombre.slice(0, 120), direccion: direccion.slice(0, 200) },
    update: nombre ? { nombre: nombre.slice(0, 120) } : {},
  })
  if (establecimiento.empresaId !== empresaId) return null
  return prisma.puntoVenta.upsert({
    where: { establecimientoId_codigo: { establecimientoId: establecimiento.id, codigo: codigoPto } },
    create: { empresaId, establecimientoId: establecimiento.id, codigo: codigoPto, activo: true },
    update: { activo: true },
  })
}

export async function marcarVenta(empresaId: string, usuario: { id: string; nombre: string }, estab: unknown, pto: unknown, body: Record<string, any>) {
  body.usuarioId = usuario.id
  body.atendidoPor = usuario.nombre
  let puntoVentaId: string | null = null
  try {
    const punto = await asegurarPunto(empresaId, estab, pto)
    if (punto && punto.empresaId === empresaId) puntoVentaId = punto.id
  } catch { /* la factura sigue; el punto se completa en el siguiente guardado */ }
  body.puntoVentaId = puntoVentaId || ""
  return puntoVentaId
}
