import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 1. Buscar empresa - sin depender de Neon
    let empresa = await prisma.empresa.findFirst();
    if (!empresa) {
      return NextResponse.json({ error: "Primero crea una Empresa en /dashboard/empresas" }, { status: 400 });
    }

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

    return NextResponse.json(cliente);

  } catch (error: any) {
    console.error("Error al guardar en DB:", error);
    // Para que no te salga el popup raro, devolvemos el error real
    if (error.code === 'P2002') {
      return NextResponse.json({ error: `Ya existe un cliente con esa identificación en esta empresa` }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al guardar en DB: " + error.message }, { status: 500 });
  }
}

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    include: { sucursales: true },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(clientes);
}