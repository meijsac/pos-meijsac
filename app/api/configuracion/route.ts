import { NextResponse } from 'next/server';

let configGuardada: any = null;

export async function GET() {
  return NextResponse.json(configGuardada || {
    ruc: '',
    razonSocial: '',
    nombreComercial: '',
    regimen: 'REGIMEN GENERAL',
    obligadoContabilidad: 'NO',
  });
}

export async function PUT(request: Request) {
  const datos = await request.json();
  configGuardada = datos;
  return NextResponse.json({ ok: true, data: configGuardada });
}

export async function POST(request: Request) {
  return PUT(request);
}