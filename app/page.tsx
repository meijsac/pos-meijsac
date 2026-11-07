import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#030712] text-gray-100 font-sans overflow-hidden">
      
      {/* EFECTO DE AURORAS FUTURISTAS EN EL FONDO */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[150px] pointer-events-none" />

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#030712]/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/colibri2.png" alt="MEJISAC" className="w-9 h-9 object-contain brightness-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">MEJISAC</span>{/* ESPACIO PARA CHIP - MAÑANA LO COLOCAMOS */}
<div className="hidden sm:flex w-24 h-7 rounded-full border border-dashed border-cyan-500/40 items-center justify-center">
  <span className="text-[10px] text-cyan-400/60">CHIP AQUÍ</span>
</div>
            <span className="hidden sm:inline bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Ecuador • SRI
            </span>
          </div>
          
          <Link href="/login" className="relative group px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 border border-white/10 hover:border-cyan-500/30 bg-white/5 hover:bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.02)]">
            <span className="relative z-10">Ingresar al Sistema</span>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="relative max-w-6xl mx-auto px-6 py-20 z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* ESPACIO PARA CHIP */}
<div className="h-8"></div>
          {/* COLUMNA IZQUIERDA: TEXTOS */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 px-3 py-1 rounded-full text-xs font-medium text-cyan-400 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Nuevo • Facturación en 30 segundos
            </span>

            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1] text-white">
              Facturación <br />
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(6,182,212,0.15)]">
                Electrónica
              </span> <br />
              sin complicaciones
            </h1>

            <p className="text-base md:text-lg text-gray-400 max-w-md leading-relaxed">
              Para tu negocio en Ecuador. <span className="text-white font-medium">Factura, Nota de Venta RIMPE</span> y WhatsApp en un solo lugar. Rápido, seguro y 100% en la nube.
            </p>

            {/* BOTONES */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/login" className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-gray-950 font-bold rounded-xl shadow-[0_4px_20px_rgba(6,182,212,0.4)] hover:shadow-[0_4px_25px_rgba(6,182,212,0.6)] hover:-translate-y-0.5 transition-all duration-300">
                Empezar Ahora →
              </Link>
              <a href="https://wa.me" target="_blank" rel="noopener noreferrer" className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-green-500/30 font-medium rounded-xl flex items-center gap-2 transition-all duration-300">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                WhatsApp
              </a>
            </div>

            {/* BADGES INFERIORES */}
            <div className="flex gap-6 pt-4 text-xs font-medium text-gray-500">
              <span className="flex items-center gap-1.5"><span className="text-cyan-400">✓</span> Válido SRI</span>
              <span className="flex items-center gap-1.5"><span className="text-cyan-400">✓</span> Sin instalación</span>
              <span className="flex items-center gap-1.5 text-amber-400">★ 4.9 / 5</span>
            </div>
          </div>

          {/* COLUMNA DERECHA: COLIBRÍ (CONTENEDOR MEJORADO) */}
          <div className="relative flex justify-center items-center">
            {/* Anillo de luz trasero */}
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl transform scale-95" />
            
            <div className="relative w-full max-w-[400px] aspect-square rounded-3xl bg-gradient-to-b from-white/10 to-white/[0.02] p-8 border border-white/10 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                {/* Eliminado el fondo negro cuadrado del colibrí para integrarlo al cristal */}
                <img src="/colibri2.png" alt="Colibrí" className="w-48 h-48 object-contain drop-shadow-[0_10px_30px_rgba(6,182,212,0.4)] transform group-hover:scale-105 transition-transform duration-500" />
              </div>

              <div className="relative z-10 text-center space-y-1">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">MEJISAC - Tu colibrí factura por ti</h3>
                <p className="text-xs text-gray-400">Rápido como un colibrí, seguro como tu negocio</p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
