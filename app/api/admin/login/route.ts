import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function sameSecret(input: string, expected: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return NextResponse.json(
      { error: "Faltan ADMIN_USERNAME o ADMIN_PASSWORD en Vercel" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const user = String(body?.user ?? "").trim();
  const pass = String(body?.pass ?? "");

  if (!sameSecret(user, expectedUser) || !sameSecret(pass, expectedPass)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
