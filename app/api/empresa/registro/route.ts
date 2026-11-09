import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { empresaParaCliente, firmarSesion } from "@/lib/empresa-sesion"
import { asegurarPlanInicial, vigenciaPlan } from "@/lib/plan-inicial"

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

    const datosRegistro = {
      provincia: body?.provincia || null,
      ciudad: body?.canton || body?.ciudad || null,
      canton: body?.canton || body?.ciudad || null,
      regimen: body?.regimen || null,
      actividad: body?.actividad || null,
      obligado: body?.obligado || body?.obligadoConta || null,
      obligadoConta: body?.obligadoConta || body?.obligado || null,
      contribuyenteEspecial: body?.contribuyenteEspecial || null,
      tipoContribuyente: body?.tipoContribuyente || null,
      sector: body?.sector || null,
      celular: body?.celular || null,
      respNombre: body?.respNombre || null,
      respCelular: body?.respCelular || null,
    }

    const existe = await prisma.empresa.findUnique({ where: { ruc }, include: { usuarios: true } })
    if (existe) {
      let usuario = existe.usuarios[0]
      if (!usuario) {
        usuario = await prisma.usuario.create({
          data: {
            nombre: adminUser,
            email: body?.correo || body?.email || null,
            password: await bcrypt.hash(adminPass, 10),
            rol: "ADMIN",
            empresaId: existe.id,
          },
        })
      }
      return NextResponse.json({ ok: true, id: existe.id, yaExistia: true, empresaId: usuario.empresaId })
    }

    let planInicial
    try {
      planInicial = await asegurarPlanInicial()
    } catch {
      return NextResponse.json({ error: "No hay Plan Inicial activo. No se creó la empresa." }, { status: 500 })
    }
    const vigencia = vigenciaPlan(planInicial)
    const empresa = await prisma.empresa.create({
      data: {
        ruc,
        razonSocial,
        nombre: body?.nombreComercial || null,
        nombreComercial: body?.nombreComercial || null,
        direccion: body?.direccion || null,
        telefono: body?.telefono || body?.celular || null,
        email: body?.email || body?.correo || null,
        datosRegistro,
        planId: planInicial.id,
        planEstado: "ACTIVO",
        planInicio: vigencia.inicio,
        planFin: vigencia.fin,
        metodoPago: "manual",
        pruebaInicio: vigencia.inicio,
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
      include: { usuarios: true },
    })

    const usuario = empresa.usuarios[0]
    if (!usuario?.empresaId) return NextResponse.json({ error: "No se vinculó el usuario con la empresa" }, { status: 500 })
    const token = firmarSesion({ id: usuario.id, empresaId: usuario.empresaId })

    return NextResponse.json({
      ok: true,
      id: empresa.id,
      estado: "ACTIVO",
      token,
      empresa: empresaParaCliente(empresa, usuario),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo registrar la empresa" }, { status: 500 })
  }
}
