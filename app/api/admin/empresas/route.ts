import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const empresas = await prisma.empresa.findMany({
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(empresas);
}