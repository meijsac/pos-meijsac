import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { texto } from "@/lib/clinica/consulta"
import { subirPrivado } from "@/lib/security/storage"

const CUBO = "historia-clinica"
const TOPE = 6 * 1024 * 1024

function tipoDe(datos: Buffer) {
  if (datos.length >= 4 && datos.subarray(0, 4).toString("utf8") === "%PDF") return "application/pdf"
  if (datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return "image/jpeg"
  return ""
}

export async function POST(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const form = await req.formData().catch(() => null)
  const archivo = form?.get("archivo")
  const consultaId = texto(form?.get("consultaId"), 40)
  const clase = texto(form?.get("clase"), 12) === "lab" ? "lab" : "imagen"
  if (!(archivo instanceof File)) return NextResponse.json({ error: "Elige un PDF o un JPG" }, { status: 400 })
  if (archivo.size <= 0 || archivo.size > TOPE) return NextResponse.json({ error: "El archivo debe pesar hasta 6 MB" }, { status: 400 })
  const consulta = await prisma.clinicaConsulta.findFirst({ where: { id: consultaId, empresaId: sesion.empresa.id }, include: { _count: { select: { archivos: true } } } })
  if (!consulta) return NextResponse.json({ error: "Esa consulta no está en esta empresa" }, { status: 404 })
  if (consulta._count.archivos >= 12) return NextResponse.json({ error: "Esta consulta ya tiene 12 archivos" }, { status: 400 })
  const datos = Buffer.from(await archivo.arrayBuffer())
  const mime = tipoDe(datos)
  if (!mime) return NextResponse.json({ error: "Solo se abre PDF o JPG" }, { status: 400 })
  const id = crypto.randomUUID()
  const extension = mime === "application/pdf" ? "pdf" : "jpg"
  const ruta = `${sesion.empresa.id}/${consulta.id}/${id}.${extension}`
  await subirPrivado(CUBO, ruta, datos, mime)
  const guardado = await prisma.clinicaArchivo.create({
    data: {
      id,
      empresaId: sesion.empresa.id,
      consultaId: consulta.id,
      nombre: texto(archivo.name, 120) || `examen.${extension}`,
      mime,
      clase,
      ruta,
    },
    select: { id: true, nombre: true, mime: true, clase: true, interpretacion: true, createdAt: true },
  })
  return NextResponse.json({ archivo: guardado })
}

export async function PUT(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const id = texto(body.id, 40)
  const archivo = await prisma.clinicaArchivo.findFirst({ where: { id, empresaId: sesion.empresa.id } })
  if (!archivo) return NextResponse.json({ error: "Ese examen no está en esta empresa" }, { status: 404 })
  const guardado = await prisma.clinicaArchivo.update({
    where: { id: archivo.id },
    data: { interpretacion: texto(body.interpretacion, 500) },
    select: { id: true, nombre: true, mime: true, clase: true, interpretacion: true, createdAt: true },
  })
  return NextResponse.json({ archivo: guardado })
}
