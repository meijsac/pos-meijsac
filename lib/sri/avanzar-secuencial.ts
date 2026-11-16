import { prisma } from "@/lib/prisma"
import { datosRegistroDe } from "@/lib/empresa-sesion"
import { codigoAmbienteFactura } from "@/lib/sri/punto-emision"

function tres(valor: unknown) {
  return String(valor ?? "").replace(/\D/g, "").padStart(3, "0").slice(-3)
}

function nueve(valor: unknown) {
  const digitos = String(valor ?? "").replace(/\D/g, "")
  return digitos ? digitos.padStart(9, "0").slice(-9) : ""
}

export async function avanzarSecuencialEmpresa(empresaId: string, ambiente: unknown, serie: string, usado: string) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true, datosRegistro: true } })
  if (!empresa || empresa.id !== empresaId) return
  const prev = datosRegistroDe(empresa.datosRegistro)
  const lista = Array.isArray(prev.secuenciales) ? prev.secuenciales.map((fila: any) => ({ ...fila })) : []
  const codigo = codigoAmbienteFactura(ambiente)
  const [estab, pto] = serie.split("-")
  const guardado = nueve(usado)
  if (!guardado || guardado === "000000000") return
  const indice = lista.findIndex((fila) => tres(fila?.estab) === tres(estab) && tres(fila?.pto) === tres(pto) && String(fila?.codigo || "01").replace(/\D/g, "").padStart(2, "0").slice(-2) === "01")
  console.log("[secuencial] emitido", { empresaId, ambiente: codigo, serie, guardado })
  if (indice < 0) {
    lista.push({ estab: tres(estab), pto: tres(pto), codigo: "01", tipo: "01 FACTURA", ultimo: guardado, estado: "ACTIVO", porAmbiente: { [codigo]: guardado } })
  } else {
    const porAmbiente = { ...(lista[indice].porAmbiente || {}), [codigo]: guardado }
    lista[indice] = { ...lista[indice], ultimo: guardado, porAmbiente, estado: lista[indice].estado || "ACTIVO" }
  }
  await prisma.empresa.update({
    where: { id: empresaId },
    data: { datosRegistro: { ...prev, secuenciales: lista } as any },
  })
}
