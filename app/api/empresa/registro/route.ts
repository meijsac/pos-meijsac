import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const ruc = String(body?.ruc || "").trim()
    const razonSocial = String(body?.razonSocial || body?.razon || "").trim()
    const adminUser = String(body?.adminUser || "").trim()
    const adminPass = String(body?.adminPass || "")

    if (ruc.length !== 13) return NextResponse.json({ error: "RUC debe tener 13 dígitos" }, { status: 400 })
    if (!razonSocial) return NextResponse.json({ error: "Razón social obligatoria" }, { status: 400 })
    if (!adminUser || adminPass.length < 6) return NextResponse.json({ error: "Usuario y contraseña del administrador son obligatorios" }, { status: 400 })

    const existe = await prisma.empresa.findUnique({ where: { ruc } })
    if (existe) return NextResponse.json({ ok: true, id: existe.id, yaExistia: true })

    const empresa = await prisma.empresa.create({
      data: {
        ruc,
        razonSocial,
        nombre: body?.nombreComercial || null,
        nombreComercial: body?.nombreComercial || null,
        direccion: body?.direccion || null,
        telefono: body?.telefono || body?.celular || null,
        email: body?.email || body?.correo || null,
        planEstado: "PRUEBA",
        pruebaInicio: new Date(),
        comprobantesUsados: 0,
        usuarios: {
          create: {
            nombre: adminUser,
            email: body?.correo || body?.email || null,
            password: await bcrypt.hash(adminPass, 10),
            rol: "ADMIN",
          },
        },
      },
    })

    return NextResponse.json({ ok: true, id: empresa.id, estado: "PRUEBA" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo registrar la empresa" }, { status: 500 })
  }
}
