import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  if(!clienteId) return NextResponse.json([]);
  const data = await prisma.sucursal.findMany({ where: { clienteId }, orderBy: { codigo: "asc" } });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const suc = await prisma.sucursal.create({ data: body });
  return NextResponse.json({ success: true, sucursal: suc });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...data } = body;
  const suc = await prisma.sucursal.update({ where: { id }, data });
  return NextResponse.json({ success: true, sucursal: suc });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  await prisma.sucursal.delete({ where: { id: id! } });
  return NextResponse.json({ success: true });
}