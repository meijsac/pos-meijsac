import { NextResponse } from "next/server"

export async function GET(req: Request){
  const { searchParams } = new URL(req.url)
  const cedula = searchParams.get("cedula")
  if(!cedula) return NextResponse.json({error:"falta cedula"}, {status:400})
  
  try{
    // API publica de Ecuador - cedula
    const res = await fetch(`https://api.cedula.ec/v1/cedula/${cedula}`, { cache: "no-store" })
    const data = await res.json()
    // Si no funciona, intenta otra
    if(data && data.nombre){
      return NextResponse.json({ nombre: data.nombre, direccion: data.direccion || "ECUADOR" })
    }
    // Fallback - API secundaria
    const res2 = await fetch(`https://sri-api.vercel.app/api/cedula/${cedula}`)
    const data2 = await res2.json()
    return NextResponse.json(data2)
  }catch(e){
    // Si falla el SRI, devolvemos para que no se caiga
    return NextResponse.json({ nombre: `PERSONA ${cedula} - SRI NO DISPONIBLE`, direccion: "TENA" })
  }
}