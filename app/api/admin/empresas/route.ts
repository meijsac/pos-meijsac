import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resumenEmpresa } from "@/lib/empresa-plan";

export async function GET() {
  try {
    const empresas = await prisma.empresa.findMany({
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    const conteos = await prisma.facturaEmitida.groupBy({
      by: ["empresaId"],
      where: { ambiente: "2", fechaAutorizacion: { not: null } },
      _count: { _all: true },
    }).catch(() => []);
    const guardados = new Map(conteos.map((fila) => [fila.empresaId, fila._count._all]))
    return NextResponse.json(empresas.map((empresa) => ({
      ...resumenEmpresa(empresa),
      comprobantesEmitidos: guardados.get(empresa.id) || 0,
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}