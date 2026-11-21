import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"

function texto(valor: unknown) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, 180)
}

function datos(payload: unknown) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, any> : {}
}

export async function POST(req: Request) {
  const sesion = await usuarioConEmpresaDesdeRequest(req)
  if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (sesion.usuario.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador descarga respaldos" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (!(await bcrypt.compare(String(body.password || ""), sesion.usuario.password))) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 })
  }
  const [facturas, clientes] = await Promise.all([
    prisma.facturaEmitida.findMany({ where: { empresaId: sesion.empresa.id }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.cliente.findMany({ where: { empresaId: sesion.empresa.id }, orderBy: { razonSocial: "asc" } }),
  ])
  const paquete = {
    empresa: sesion.empresa.nombreComercial || sesion.empresa.razonSocial || "",
    descargado: new Date().toISOString(),
    clientes: clientes.map((c) => ({
      identificacion: c.identificacion,
      nombre: c.razonSocial,
      email: c.email || "",
      telefono: c.telefono || "",
      direccion: c.direccion || "",
    })),
    facturas: facturas.map((f) => {
      const p = datos(f.payload)
      const cliente = datos(p.cliente)
      const totales = datos(p.totales)
      return {
        numero: texto(p.secuencial),
        serie: texto(p.establecimiento),
        fecha: texto(p.fechaEmisionFormato || f.createdAt.toISOString().slice(0, 10)),
        cliente: texto(cliente.razon || cliente.razonSocial),
        identificacion: texto(cliente.identificacion),
        total: texto(totales.total),
        estado: f.estado,
      }
    }),
  }
  await prisma.seguridadLog.create({ data: { empresaId: sesion.empresa.id, usuario: sesion.usuario.nombre, accion: "RESPALDO", detalle: "descarga de clientes y facturas" } })
  const archivo = `\uFEFF${JSON.stringify(paquete, null, 2)}`
  return new NextResponse(archivo, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"respaldo-meijsac.json\"",
    },
  })
}
