import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: Request){
  try{
    const { mensaje } = await req.json()
    const m = (mensaje || "").toLowerCase()

    let respuesta = ""

    if(m.includes("sri") || m.includes("sdi") || m.includes("activo") || m.includes("caido") || m.includes("estado")){
      try{
        const r = await fetch("https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl", { cache: "no-store", signal: AbortSignal.timeout(3000) })
        if(r.ok){
          respuesta = "Tranquila, yo te ayudo. El servicio está respondiendo, así que puedes emitir con calma. ¿qué hacemos ahora?"
        } else {
          respuesta = "Tranquila, yo te ayudo. El servicio no está respondiendo. Dejamos el comprobante guardado y lo enviamos cuando vuelva. ¿qué hacemos ahora?"
        }
      }catch{
        respuesta = "Tranquila, yo te ayudo. No pude confirmar el servicio en este momento. Seguimos con lo guardado y lo revisamos en un rato. ¿qué hacemos ahora?"
      }
    } else if(m.includes("hola") || m.includes("es isa") || m.includes("quien eres")){
      respuesta = "Hola, soy ESISA. Te explico paso a paso, sin prisa. ¿qué hacemos ahora?"
    } else {
      const variantes = [
        "Tranquila, yo te ayudo. Vamos de una cosa a la vez y te digo el siguiente paso. ¿qué hacemos ahora?",
        "Listo, ya te entendí. Lo vemos fácil, sin saltarnos nada. ¿qué hacemos ahora?",
        "Aquí estoy. Dime en qué paso vas y lo seguimos juntas. ¿qué hacemos ahora?",
      ]
      respuesta = variantes[String(mensaje || "").length % variantes.length]
    }

    return NextResponse.json({ respuesta })

  }catch{
    return NextResponse.json({ respuesta: "Tranquila, yo te ayudo. Se cortó un momento y ya volví. ¿qué hacemos ahora?" })
  }
}