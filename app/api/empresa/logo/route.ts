import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { usuarioConEmpresaDesdeRequest } from "@/lib/empresa-sesion"
import { errorLogo, mimeDeLogo } from "@/lib/logo-empresa"

export async function POST(req: Request) {
  try {
    const sesion = await usuarioConEmpresaDesdeRequest(req)
    if ("error" in sesion) return NextResponse.json({ error: sesion.error }, { status: sesion.status })

    const form = await req.formData()
    const archivo = form.get("file")
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "No se pudo guardar el logo: no llegó la imagen. Intenta de nuevo." }, { status: 400 })
    }
    const aviso = errorLogo(archivo.name, archivo.type, archivo.size)
    if (aviso) return NextResponse.json({ error: `No se pudo guardar el logo: ${aviso}` }, { status: 400 })

    const mime = mimeDeLogo(archivo.name, archivo.type)
    const bytes = Buffer.from(await archivo.arrayBuffer())
    const logoUrl = `data:${mime};base64,${bytes.toString("base64")}`
    const prev = sesion.empresa.datosRegistro && typeof sesion.empresa.datosRegistro === "object" && !Array.isArray(sesion.empresa.datosRegistro)
      ? sesion.empresa.datosRegistro as Record<string, unknown>
      : {}

    await prisma.empresa.update({
      where: { id: sesion.empresa.id },
      data: {
        datosRegistro: {
          ...prev,
          logo_url: logoUrl,
          logoUrl,
          marca_ride: logoUrl,
        } as any,
      },
    })

    return NextResponse.json({ logo_url: logoUrl, marca_ride: logoUrl })
  } catch (e: any) {
    return NextResponse.json({ error: `No se pudo guardar el logo: ${e.message || "error de base"}. Intenta de nuevo.` }, { status: 500 })
  }
}
