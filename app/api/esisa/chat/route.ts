import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: Request){
  try{
    const { mensaje } = await req.json()
    const m = (mensaje || "").toLowerCase()

    let respuesta = ""

    if(m.includes("sri") || m.includes("sdi") || m.includes("activo") || m.includes("caido") || m.includes("estado")){
      // Verificamos SRI real sin llamarse a si mismo
      try{
        const r = await fetch("https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl", { cache: "no-store", signal: AbortSignal.timeout(3000) })
        if(r.ok){
          respuesta = "Papá, verifiqué ahora mismo: el SRI está OPERATIVO 🟢. Puedes facturar normal, sin contingencia."
        } else {
          respuesta = "Papá, lo verifiqué: el SRI está CAÍDO 🔴. Activa contingencia tipo 2, guarda las facturas, tienes 72h para reenviar."
        }
      }catch{
        respuesta = "Papá, intenté verificar el SRI y no responde en este momento. Mejor guarda en contingencia por si acaso."
      }
    } else if(m.includes("hola") || m.includes("es isa") || m.includes("quien eres")){
      respuesta = "Hola, soy ESISA. Puedo verificar el SRI y ayudarte a facturar. ¿Qué necesitas?"
    } else {
      respuesta = `Entendido papá. Ya registré eso de: "${mensaje}". ¿Qué más hacemos en el POS?`
    }

    return NextResponse.json({ respuesta })

  }catch(e){
    return NextResponse.json({ respuesta: "Papá, me quedé sin internet un momento, ¿me repites?" })
  }
}