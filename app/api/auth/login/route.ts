import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { empresaParaCliente, firmarSesion } from "@/lib/empresa-sesion"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const ruc = String(body.ruc || "").trim()
    const password = String(body.password || "")

    if (!ruc || !password) {
      return NextResponse.json({ error: "Falta RUC o clave" }, { status: 400 })
    }

    const usuarios = await prisma.usuario.findMany({
      where: { empresa: { ruc } },
      include: { empresa: true },
    })

    if (usuarios.length === 0) {
      const empresa = await prisma.empresa.findFirst({ where: { ruc } })
      if (!empresa) return NextResponse.json({ error: `RUC ${ruc} no existe` }, { status: 404 })
      return NextResponse.json({ error: "Empresa sin usuario vinculado" }, { status: 404 })
    }

    let usuario = null as (typeof usuarios)[number] | null
    for (const candidato of usuarios) {
      if (await bcrypt.compare(password, candidato.password)) {
        usuario = candidato
        break
      }
    }

    if (!usuario?.empresa || !usuario.empresaId) {
      return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 })
    }

    const token = firmarSesion({ id: usuario.id, empresaId: usuario.empresaId })
    const empresa = empresaParaCliente(usuario.empresa, usuario)

    return NextResponse.json({
      token,
      usuario: { nombre: usuario.nombre, empresa: empresa.razonSocial, rol: usuario.rol, ruc: empresa.ruc, empresaId: usuario.empresaId },
      empresa,
    })
  } catch (e: any) {
    console.error("ERROR REAL LOGIN:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
