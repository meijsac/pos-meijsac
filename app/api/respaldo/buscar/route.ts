import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { puede } from "@/lib/seguridad"

export const dynamic = "force-dynamic"

function datosDe(payload: unknown) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, any> : {}
}

function diaDe(datos: Record<string, any>, creado: Date) {
  const texto = String(datos.fechaEmisionFormato || datos.fechaEmision || "")
  const partida = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (partida) return `${partida[3]}-${partida[2]}-${partida[1]}`
  const iso = texto.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(creado)
}

function numeroDe(datos: Record<string, any>) {
  const estab = String(datos.establecimiento || datos.estab || "").trim()
  const secuencial = String(datos.secuencial || "").replace(/\D/g, "")
  if (estab && secuencial) return `${estab}-${secuencial.padStart(9, "0")}`
  return String(datos.numeroFactura || datos.secuencial || "")
}

function clienteDe(datos: Record<string, any>) {
  const cliente = datos.cliente && typeof datos.cliente === "object" ? datos.cliente : {}
  return String(cliente.razon || datos.clienteNombre || datos.razonSocialComprador || "")
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: "No hay sesión" }, { status: 401 })
  if (!puede(sesion.usuario.rol, "facturar")) return NextResponse.json({ error: "Tu rol no puede ver respaldos" }, { status: 403 })
  const url = new URL(req.url)
  const fecha = String(url.searchParams.get("fecha") || "").slice(0, 10)
  const cliente = String(url.searchParams.get("cliente") || "").trim().toLowerCase()
  const numero = String(url.searchParams.get("numero") || "").replace(/\s/g, "")
  const filas = await prisma.facturaEmitida.findMany({
    where: { empresaId: sesion.empresa.id },
    orderBy: { createdAt: "desc" },
    take: 800,
  })
  const lista = filas.flatMap((fila) => {
    const datos = datosDe(fila.payload)
    const dia = diaDe(datos, fila.createdAt)
    const documento = numeroDe(datos)
    const nombre = clienteDe(datos)
    if (fecha && dia !== fecha) return []
    if (cliente && !nombre.toLowerCase().includes(cliente)) return []
    if (numero && !documento.replace(/\s/g, "").includes(numero) && !String(datos.secuencial || "").includes(numero.replace(/\D/g, ""))) return []
    return [{
      id: fila.id,
      fecha: dia,
      cliente: nombre,
      numero: documento,
      estado: String(datos.estadoSRI || ""),
    }]
  })
  return NextResponse.json({ filas: lista.slice(0, 80) })
}
