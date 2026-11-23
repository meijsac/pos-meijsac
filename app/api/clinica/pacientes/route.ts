import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { cedulaValida } from "@/lib/optica/cedula"
import { TEXTO_DATOS_CLINICA, texto } from "@/lib/clinica/consulta"

export async function GET(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const q = texto(req.nextUrl.searchParams.get("q"), 60)
  const pacientes = await prisma.clinicaPaciente.findMany({
    where: {
      empresaId: sesion.empresa.id,
      ...(q ? {
        OR: [
          { identificacion: { contains: q } },
          { nombres: { contains: q, mode: "insensitive" } },
          { apellidos: { contains: q, mode: "insensitive" } },
          { numeroHistoria: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  })
  return NextResponse.json({ pacientes })
}

export async function POST(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const body = await req.json().catch(() => ({}))
  const tipoDocumento = texto(body.tipoDocumento, 20) === "PASAPORTE" ? "PASAPORTE" : "CEDULA"
  const identificacion = tipoDocumento === "CEDULA" ? texto(body.identificacion, 20).replace(/\D/g, "") : texto(body.identificacion, 20)
  const nombres = texto(body.nombres, 80)
  const apellidos = texto(body.apellidos, 80)
  if (!nombres || !apellidos) return NextResponse.json({ error: "Escribe nombres y apellidos" }, { status: 400 })
  if (tipoDocumento === "CEDULA" && !cedulaValida(identificacion)) return NextResponse.json({ error: "La cédula no es válida" }, { status: 400 })
  if (tipoDocumento === "PASAPORTE" && identificacion.length < 4) return NextResponse.json({ error: "Escribe el pasaporte" }, { status: 400 })
  if (!body.consentimiento) return NextResponse.json({ error: "Marca la autorización de uso de datos de salud" }, { status: 400 })
  const fecha = texto(body.fechaNacimiento, 10)
  const nacimiento = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T00:00:00.000Z`) : null
  const total = await prisma.clinicaPaciente.count({ where: { empresaId: sesion.empresa.id } })
  try {
    const paciente = await prisma.clinicaPaciente.create({
      data: {
        empresaId: sesion.empresa.id,
        tipoDocumento,
        identificacion,
        nombres,
        apellidos,
        fechaNacimiento: nacimiento,
        sexo: texto(body.sexo, 20),
        grupoSanguineo: texto(body.grupoSanguineo, 8).toUpperCase(),
        alergias: texto(body.alergias, 160),
        telefono: texto(body.telefono, 20),
        email: texto(body.email, 80),
        direccion: texto(body.direccion, 160),
        numeroHistoria: `HCU-${String(total + 1).padStart(5, "0")}`,
        consentimientoAt: new Date(),
      },
    })
    return NextResponse.json({ paciente, aviso: TEXTO_DATOS_CLINICA })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ese documento ya está registrado en esta empresa" }, { status: 409 })
    }
    throw error
  }
}
