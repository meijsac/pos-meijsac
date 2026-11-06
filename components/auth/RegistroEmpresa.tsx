'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegistroEmpresa() {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [regimen, setRegimen] = useState('')
  const [modo, setModo] = useState('')

  const finalizarRegistro = (modoFinal: string) => {
    setModo(modoFinal)
    
    // Guardamos todo lo que escogió para usarlo después en el modulador
    const datos = {
      regimen: regimen, // RIMPE_NEGOCIO_POPULAR, RIMPE_EMPRENDEDOR, GENERAL
      modoFacturacion: modoFinal, // POS_TICKET, FACTURA_ELECTRONICA_SIN_IVA, FACTURA_ELECTRONICA
      // para bloquear POS después
      posTicketHabilitado: regimen === 'RIMPE_NEGOCIO_POPULAR', 
      fecha: new Date().toISOString()
    }
    localStorage.setItem('meijsac_empresa', JSON.stringify(datos))

    alert('✅ Te has registrado con éxito')
    router.push('/dashboard') // <-- YA NO VA A facturador-xml, va al principal
  }

  return (
    <div>
      {paso === 1 && (
        <>
          <h2>PASO 1: Régimen SRI</h2>
          <select value={regimen} onChange={e => setRegimen(e.target.value)}>
            <option value="">Selecciona</option>
            <option value="RIMPE_NEGOCIO_POPULAR">RIMPE - Negocio Popular</option>
            <option value="RIMPE_EMPRENDEDOR">RIMPE - Emprendedor</option>
            <option value="GENERAL">Régimen General</option>
          </select>
          <button onClick={() => setPaso(2)} disabled={!regimen}>Siguiente</button>
        </>
      )}

      {paso === 2 && regimen === 'RIMPE_NEGOCIO_POPULAR' && (
        <>
          <h2>PASO 2: ¿Cómo quieres facturar?</h2>
          <button onClick={() => finalizarRegistro('POS_TICKET')}>POS TICKET - Nota de Venta</button>
          <button onClick={() => finalizarRegistro('FACTURA_ELECTRONICA_SIN_IVA')}>Facturador XML - RIMPE Popular (Sin IVA)</button>
        </>
      )}

      {paso === 2 && regimen !== 'RIMPE_NEGOCIO_POPULAR' && (
        <>
          <h2>Debes usar Facturador Electrónico XML</h2>
          <p>Por ser {regimen}, el SRI te obliga a facturación electrónica.</p>
          <button onClick={() => finalizarRegistro('FACTURA_ELECTRONICA')}>FACTURADOR ELECTRÓNICO XML</button>
        </>
      )}
    </div>
  )
}