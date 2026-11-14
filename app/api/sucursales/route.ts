import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion";

async function clientePropio(clienteId: string, empresaId: string) {
  if (!clienteId) return null;
  return prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
}

export async function GET(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req);
  if ("error" in sesion) return NextResponse.json([], { status: sesion.status });
  const clienteId = new URL(req.url).searchParams.get("clienteId") || "";
  const propio = await clientePropio(clienteId, sesion.empresa.id);
  if (!propio) return NextResponse.json([]);
  const data = await prisma.sucursal.findMany({ where: { clienteId }, orderBy: { codigo: "asc" } });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req);
  if ("error" in sesion) return NextResponse.json({ success: false, error: sesion.error }, { status: sesion.status });
  const body = await req.json();
  const propio = await clientePropio(String(body?.clienteId || ""), sesion.empresa.id);
  if (!propio) return NextResponse.json({ success: false, error: "Ese cliente no es de tu empresa" }, { status: 404 });
  const suc = await prisma.sucursal.create({
    data: {
      clienteId: propio.id,
      codigo: String(body.codigo || ""),
      nombre: String(body.nombre || ""),
      direccion: String(body.direccion || ""),
      provincia: String(body.provincia || "PICHINCHA"),
      ciudad: String(body.ciudad || "QUITO"),
      telefono: body.telefono ? String(body.telefono) : null,
      email: body.email ? String(body.email) : null,
      esMatriz: Boolean(body.esMatriz),
    },
  });
  return NextResponse.json({ success: true, sucursal: suc });
}

export async function PUT(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req);
  if ("error" in sesion) return NextResponse.json({ success: false, error: sesion.error }, { status: sesion.status });
  const body = await req.json();
  const id = String(body?.id || "");
  const actual = await prisma.sucursal.findFirst({ where: { id }, include: { cliente: true } });
  if (!actual || actual.cliente.empresaId !== sesion.empresa.id) {
    return NextResponse.json({ success: false, error: "No encontré esta sucursal" }, { status: 404 });
  }
  const suc = await prisma.sucursal.update({
    where: { id },
    data: {
      codigo: body.codigo != null ? String(body.codigo) : actual.codigo,
      nombre: body.nombre != null ? String(body.nombre) : actual.nombre,
      direccion: body.direccion != null ? String(body.direccion) : actual.direccion,
      provincia: body.provincia != null ? String(body.provincia) : actual.provincia,
      ciudad: body.ciudad != null ? String(body.ciudad) : actual.ciudad,
      telefono: body.telefono != null ? String(body.telefono) : actual.telefono,
      email: body.email != null ? String(body.email) : actual.email,
      esMatriz: body.esMatriz != null ? Boolean(body.esMatriz) : actual.esMatriz,
    },
  });
  return NextResponse.json({ success: true, sucursal: suc });
}

export async function DELETE(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req);
  if ("error" in sesion) return NextResponse.json({ success: false, error: sesion.error }, { status: sesion.status });
  const id = new URL(req.url).searchParams.get("id") || "";
  const actual = await prisma.sucursal.findFirst({ where: { id }, include: { cliente: true } });
  if (!actual || actual.cliente.empresaId !== sesion.empresa.id) {
    return NextResponse.json({ success: false, error: "No encontré esta sucursal" }, { status: 404 });
  }
  await prisma.sucursal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
