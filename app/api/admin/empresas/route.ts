import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resumenEmpresa } from "@/lib/empresa-plan";

export async function GET() {
  try {
    const empresas = await prisma.empresa.findMany({
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(empresas.map(resumenEmpresa));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}