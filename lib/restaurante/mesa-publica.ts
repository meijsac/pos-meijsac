import { prisma } from "@/lib/prisma"
import { vistaPublicaMesa } from "@/lib/restaurante/vista-mesa"

export async function mesaPublica(codigo: string) {
  const clave = String(codigo || "").toLowerCase()
  if (!/^[a-f0-9]{20}$/.test(clave)) return null
  const filas = await prisma.restauranteEstado.findMany({
    select: {
      mesas: true,
      menu: true,
      categorias: true,
      empresa: { select: { nombreComercial: true, nombre: true, razonSocial: true } },
    },
  })
  for (const fila of filas) {
    const mesas = Array.isArray(fila.mesas) ? fila.mesas : []
    const mesa = mesas.find((item) => item && typeof item === "object" && String((item as { codigo?: string }).codigo || "").toLowerCase() === clave)
    if (!mesa || typeof mesa !== "object") continue
    const empresa = fila.empresa
    const local = empresa?.nombreComercial || empresa?.nombre || empresa?.razonSocial || "Restaurante"
    return vistaPublicaMesa(mesa as { nombre?: string; zona?: string; estado?: string; items?: [] }, fila.menu, fila.categorias, local)
  }
  return null
}
