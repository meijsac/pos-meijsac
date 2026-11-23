import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

const HORAS = 12;

function sesionAdmin(pass: string) {
  const cuerpo = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + HORAS * 3600 })).toString("base64url");
  const firma = createHmac("sha256", pass).update(cuerpo).digest("base64url");
  return `${cuerpo}.${firma}`;
}

function conCookie(res: NextResponse, token: string) {
  res.cookies.set("meijsac_admin", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HORAS * 3600,
  });
  return res;
}

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

  return conCookie(NextResponse.json({ ok: true }), sesionAdmin(expectedPass));
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("meijsac_admin", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return res;
}
