import { prisma } from "@/lib/prisma"
import { SEMILLA_CATALOGOS, publicarTarifas } from "@/lib/sri/catalogos-base"

export async function asegurarCatalogos() {
  const total = await prisma.catalogoSri.count()
  if (total > 0) return
  await prisma.catalogoSri.createMany({
    data: SEMILLA_CATALOGOS.map((fila) => ({
      grupo: fila.grupo,
      codigo: fila.codigo,
      descripcion: fila.descripcion,
      porcentaje: fila.porcentaje,
      vigente: true,
      actualizadoPor: "sistema",
    })),
    skipDuplicates: true,
  })
}

export async function refrescarTarifas() {
  try {
    await asegurarCatalogos()
    const filas = await prisma.catalogoSri.findMany({ where: { grupo: "IVA", vigente: true } })
    const mapa: Record<string, number> = {}
    for (const fila of filas) mapa[fila.codigo] = Number(fila.porcentaje)
    if (Object.keys(mapa).length) publicarTarifas(mapa)
  } catch {
    publicarTarifas({})
  }
}
