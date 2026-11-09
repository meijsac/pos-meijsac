import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

let configGuardada: any = null;

export async function GET() {
  return NextResponse.json(configGuardada || {
    ruc: '',
    razonSocial: '',
    nombreComercial: '',
    regimen: '',
    obligadoContabilidad: '',
  });
}

export async function PUT(request: Request) {
  const datos = await request.json();
  configGuardada = datos;
  return NextResponse.json({ ok: true, data: configGuardada });
}

export async function POST(request: Request) {
  const datos = await request.json();
  configGuardada = datos;
  const ruc = String(datos?.ruc || "").trim();
  if (ruc) {
    const empresa = await prisma.empresa.findUnique({ where: { ruc } });
    if (empresa) {
      const prev = empresa.datosRegistro && typeof empresa.datosRegistro === "object" && !Array.isArray(empresa.datosRegistro)
        ? empresa.datosRegistro as Record<string, unknown>
        : {};
      await prisma.empresa.update({
        where: { id: empresa.id },
        data: {
          razonSocial: datos.razonSocial || empresa.razonSocial,
          nombreComercial: datos.nombreComercial ?? empresa.nombreComercial,
          direccion: datos.dirMatriz || datos.direccion || empresa.direccion,
          telefono: datos.telefono ?? empresa.telefono,
          email: datos.email ?? empresa.email,
          datosRegistro: {
            ...prev,
            regimen: datos.regimen ?? prev.regimen ?? "",
            obligadoConta: datos.obligadoConta ?? prev.obligadoConta ?? "",
            ambiente: datos.ambiente ?? prev.ambiente ?? "",
            dirMatriz: datos.dirMatriz ?? prev.dirMatriz ?? "",
            dirEstablecimiento: datos.dirEstablecimiento ?? prev.dirEstablecimiento ?? "",
            sucursales: datos.sucursales ?? prev.sucursales ?? [],
            logoUrl: datos.logoUrl ?? prev.logoUrl ?? "",
            provincia: datos.provincia ?? prev.provincia ?? "",
            ciudad: datos.ciudad ?? prev.ciudad ?? "",
            actividad: datos.actividad ?? prev.actividad ?? "",
          } as any,
        },
      });
    }
  }
  return NextResponse.json({ ok: true, data: configGuardada });
}