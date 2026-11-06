import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const ruc = String(body.ruc || '').trim()
    const password = String(body.password || '').trim()

    if (!ruc || !password) {
      return NextResponse.json({ error: 'Falta RUC o clave' }, { status: 400 })
    }

    // USAMOS findFirst, NUNCA findUnique para evitar tu error
    const empresa = await prisma.empresa.findFirst({ 
      where: { ruc } 
    })
    
    if (!empresa) {
      return NextResponse.json({ error: `RUC ${ruc} no existe` }, { status: 404 })
    }

    const usuario = await prisma.usuario.findFirst({
      where: { empresaId: empresa.id },
    })

    if (!usuario) {
      return NextResponse.json({ error: 'Empresa sin usuarios' }, { status: 404 })
    }

    const valid = await bcrypt.compare(password, usuario.password)
    if (!valid) {
      return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
    }

    const token = jwt.sign(
      { id: usuario.id, empresaId: empresa.id },
      'MEIJSAC_SECRET_2026',
      { expiresIn: '8h' }
    )

    return NextResponse.json({
      token,
      usuario: { nombre: usuario.nombre, empresa: empresa.nombre, rol: usuario.rol }
    })

  } catch (e: any) {
    console.error("ERROR REAL LOGIN:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}