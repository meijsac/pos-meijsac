import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const empresas = await prisma.empresa.findMany();
    return NextResponse.json(empresas);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}