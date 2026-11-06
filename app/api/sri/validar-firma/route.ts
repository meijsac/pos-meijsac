import { NextRequest, NextResponse } from 'next/server';
import * as forge from 'node-forge';

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try{
    const formData = await req.formData();
    const file = formData.get('p12') as File;
    const clave = formData.get('clave') as string;
    const rucEmpresa = formData.get('rucEmpresa') as string;

    if(!file) return NextResponse.json({ok:false, error:"Sube el archivo.p12"}, {status:400});

    const arrayBuffer = await file.arrayBuffer();
    const p12Der = forge.util.createBuffer(arrayBuffer as any);
    const p12Asn1 = forge.asn1.fromDer(p12Der);

    let p12:any;
    try{
      p12 = (forge.pkcs12 as any).pkcs12FromAsn1(p12Asn1, clave);
    }catch{
      return NextResponse.json({ok:false, error:"Contraseña de firma incorrecta"});
    }

    const certBags = p12.getBags({bagType: forge.pki.oids.certBag})[forge.pki.oids.certBag];
    const cert = certBags[0].cert;

    const fechaExp = cert.validity.notAfter;
    const diasRestantes = Math.ceil((fechaExp.getTime() - Date.now()) / (1000*60*60*24));

    const subject = (cert.subject.attributes as any[]).map(a=>a.value).join(' ');

    return NextResponse.json({
      ok: true,
      ruc: rucEmpresa,
      titular: subject,
      expira: fechaExp,
      dias: diasRestantes,
      valido: diasRestantes > 0
    })

  }catch(e:any){
    return NextResponse.json({ok:false, error: e.message}, {status:500})
  }
}