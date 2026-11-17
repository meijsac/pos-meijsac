import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { cedulaValida } from "@/lib/optica/cedula"
import { TEXTO_DATOS_OPTICA } from "@/lib/optica/consulta"

function texto(valor: unknown, tope = 120) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, tope)
}

export async function GET(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const q = String(req.nextUrl.searchParams.get("q") || "").trim()
  const [config, pacientes] = await Promise.all([
    prisma.opticaConfig.findUnique({ where: { empresaId: sesion.empresa.id } }),
    prisma.opticaPaciente.findMany({
      where: {
        empresaId: sesion.empresa.id,
        ...(q ? {
          OR: [
            { identificacion: { contains: q } },
            { nombres: { contains: q, mode: "insensitive" } },
            { apellidos: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
  ])
  return NextResponse.json({
    usuario: { nombre: sesion.usuario.nombre },
    config: {
      unicodigo: config?.unicodigo || "",
      registroAcess: config?.registroAcess || "",
      registroSenescyt: config?.registroSenescyt || "",
      cedulaProfesional: config?.cedulaProfesional || "",
    },
    pacientes,
  })
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
  if (!body.consentimiento) return NextResponse.json({ error: "Marca la autorización de uso de datos" }, { status: 400 })
  const fecha = texto(body.fechaNacimiento, 10)
  const nacimiento = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T00:00:00.000Z`) : null
  try {
    const paciente = await prisma.opticaPaciente.create({
      data: {
        empresaId: sesion.empresa.id,
        tipoDocumento,
        identificacion,
        nombres,
        apellidos,
        fechaNacimiento: nacimiento,
        sexo: texto(body.sexo, 20),
        telefono: texto(body.telefono, 20),
        email: texto(body.email, 80),
        direccion: texto(body.direccion, 160),
        ocupacion: texto(body.ocupacion, 80),
        consentimientoAt: new Date(),
        consentimientoTexto: TEXTO_DATOS_OPTICA,
      },
    })
    return NextResponse.json({ paciente })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ese documento ya está registrado en esta óptica" }, { status: 409 })
    }
    return NextResponse.json({ error: "No se pudo guardar el paciente" }, { status: 500 })
  }
}
