import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const empresaId = searchParams.get('empresaId')
  const where = empresaId && empresaId !== 'null' ? { empresaId } : {}
  const productos = await prisma.producto.findMany({ where, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(productos)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { nombre, codigo, categoria, precio, costo, stock, stockMinimo, empresaId } = body
  const producto = await prisma.producto.create({
    data: {
      nombre,
      codigo: codigo || null,
      categoria: categoria || null,
      precio: Number(precio),
      costo: Number(costo) || 0,
      stock: Number(stock) || 0,
      stockMinimo: Number(stockMinimo) || 5,
      empresaId
    }
  })
  return NextResponse.json(producto)
}