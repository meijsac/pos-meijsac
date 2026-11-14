import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion";

export async function POST(req: NextRequest) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req);
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status });
    const body = await req.json();
    const empresa = sesion.empresa;

    const {
      tipoId, identificacion, razonSocial, nombreComercial,
      tipoCliente, email, telefono, direccion, provincia, ciudad,
      diasCredito, limiteCredito, categoria, descuento,
      sucursales // viene del formulario que vi: 002 IMPORQUITO etc
    } = body;

    if (!identificacion || !razonSocial) {
      return NextResponse.json({ error: "Falta identificación o razón social" }, { status: 400 });
    }

    // 2. Crear cliente con sucursales
    const cliente = await prisma.cliente.create({
      data: {
        empresaId: empresa.id,
        tipoId: tipoId || "05",
        identificacion: identificacion.trim(),
        razonSocial: razonSocial.trim(),
        nombreComercial: nombreComercial || null,
        tipoCliente: tipoCliente || "DETALLISTA",
        email: email || null,
        telefono: telefono || null,
        direccion: direccion || null,
        provincia: provincia || "PICHINCHA",
        ciudad: ciudad || "QUITO",
        diasCredito: Number(diasCredito) || 0,
        limiteCredito: Number(limiteCredito) || 0,
        categoria: categoria || "DETALLISTA",
        descuento: Number(descuento) || 0,
        // Si mandas sucursales del formulario
        sucursales: sucursales && sucursales.length > 0 ? {
          create: sucursales.map((s: any) => ({
            codigo: s.codigo,
            nombre: s.nombre,
            direccion: s.direccion,
            provincia: s.provincia,
            ciudad: s.ciudad,
            telefono: s.telefono,
            esMatriz: s.esMatriz || false,
          }))
        } : undefined
      }
    });

    return NextResponse.json({ success: true, cliente });

  } catch (error: any) {
    console.error("Error al guardar en DB:", error);
    // Para que no te salga el popup raro, devolvemos el error real
    if (error.code === 'P2002') {
      return NextResponse.json({ error: `Ya existe un cliente con esa identificación en esta empresa` }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al guardar en DB: " + error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req);
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status });
    const body = await req.json();
    const id = String(body?.id || "");
    const identificacion = String(body?.identificacion || "").trim();
    const razonSocial = String(body?.razonSocial || "").trim();
    if (!id) return NextResponse.json({ error: "Falta el cliente" }, { status: 400 });
    if (!identificacion || !razonSocial) return NextResponse.json({ error: "Falta identificación o razón social" }, { status: 400 });
    const existe = await prisma.cliente.findFirst({ where: { id, empresaId: sesion.empresa.id } });
    if (!existe) return NextResponse.json({ error: "No encontré este cliente" }, { status: 404 });
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        tipoId: String(body.tipoId || "05"),
        identificacion,
        razonSocial,
        nombreComercial: String(body.nombreComercial || "").trim() || null,
        tipoCliente: String(body.tipoCliente || "DETALLISTA"),
        email: String(body.email || "").trim() || null,
        telefono: String(body.telefono || "").trim() || null,
        direccion: String(body.direccion || "").trim() || null,
        provincia: String(body.provincia || "PICHINCHA"),
        ciudad: String(body.ciudad || "QUITO"),
        diasCredito: Number(body.diasCredito) || 0,
        limiteCredito: Number(body.limiteCredito) || 0,
        categoria: String(body.categoria || "DETALLISTA"),
        descuento: Number(body.descuento) || 0,
      },
    });
    return NextResponse.json({ success: true, cliente });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un cliente con esa identificación en esta empresa" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al guardar en DB: " + (error.message || "No se pudo actualizar") }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req);
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status });
  const clientes = await prisma.cliente.findMany({
    where: { empresaId: sesion.empresa.id },
    include: { sucursales: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(clientes);
}

export async function DELETE(req: NextRequest) {
  const sesion = await usuarioConEmpresaDesdeRequest(req);
  if ("error" in sesion) return NextResponse.json({ success: false, error: sesion.error }, { status: sesion.status });
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "");
  const identificacion = String(url.searchParams.get("identificacion") || "").trim();
  if (!id && !identificacion) return NextResponse.json({ success: false, error: "Falta el cliente" }, { status: 400 });
  const existe = await prisma.cliente.findFirst({
    where: id
      ? { id, empresaId: sesion.empresa.id }
      : { identificacion, empresaId: sesion.empresa.id },
  });
  if (!existe) return NextResponse.json({ success: false, error: "No encontré este cliente" }, { status: 404 });
  await prisma.cliente.delete({ where: { id: existe.id } });
  return NextResponse.json({ success: true });
}