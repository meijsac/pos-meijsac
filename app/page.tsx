import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F6F9FC] text-[#0A2A4A] font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/colibri2.png" alt="MEJISAC" className="w-10 h-10 object-contain rounded-lg" />
            <span className="text-2xl font-black tracking-tight">MEJISAC</span>
            <span className="hidden sm:inline bg-cyan-100 text-cyan-800 text-[11px] font-bold px-2 py-1 rounded-full">ECUADOR • SRI</span>
          </div>
          <Link href="/login" className="bg-[#0A2A4A] text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-cyan-600 transition shadow-lg">
            Ingresar al Sistema
          </Link>
        </div>
      </header>

      {/* HERO */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="bg-white border shadow-sm px-3 py-1.5 rounded-full text-xs font-bold text-cyan-700">✨ Nuevo • Facturación en 30 segundos</span>
            <h1 className="text-4xl md:text-6xl font-black leading-[1.05] mt-5">
              Facturación<br/>
              <span className="bg-gradient-to-r from-cyan-500 to-teal-400 bg-clip-text text-transparent">Electrónica</span><br/>
              sin complicaciones
            </h1>
            <p className="mt-4 text-slate-600 text-lg leading-relaxed">
              Para tu negocio en Ecuador. <b className="text-slate-900">Factura, Nota de Venta RIMPE</b> y WhatsApp en un solo lugar. Rápido, seguro y 100% en la nube.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link href="/login" className="bg-blue-600 text-white px-6 py-3.5 rounded-full font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition">
                Empezar Ahora →
              </Link>
              <a href="https://wa.me/593999999999" target="_blank" className="bg-[#25D366] text-white px-6 py-3.5 rounded-full font-bold shadow-lg shadow-green-200">
                WhatsApp
              </a>
            </div>
            <div className="flex gap-6 mt-6 text-sm text-slate-500">
              <span>✅ Válido SRI</span>
              <span>✅ Sin instalación</span>
              <span>⭐ 4.9 / 5</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-cyan-300 blur-3xl opacity-30 rounded-full"></div>
            <div className="relative bg-[#0A2A4A] rounded-[2rem] p-8 text-center shadow-2xl overflow-hidden">
              <img src="/colibri2.png" alt="Colibrí MEJISAC" className="w-64 h-64 object-contain mx-auto drop-shadow-2xl" />
              <p className="text-white font-bold mt-2">MEJISAC - Tu colibrí factura por ti</p>
              <p className="text-cyan-200 text-sm mt-1">Rápido como un colibrí, seguro como tu negocio</p>
            </div>
          </div>
        </div>

        {/* TARJETAS */}
        <div className="grid md:grid-cols-3 gap-4 mt-12">
          <div className="bg-white rounded-3xl p-6 shadow-sm border text-center hover:shadow-xl hover:-translate-y-1 transition">
            <div className="text-4xl">🧾</div>
            <h3 className="font-black text-lg mt-3">Facturación Electrónica</h3>
            <p className="text-slate-500 text-sm mt-1">Emite comprobantes válidos al SRI de forma rápida y segura</p>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm border text-center hover:shadow-xl hover:-translate-y-1 transition relative">
            <span className="absolute top-4 right-4 bg-green-500 text-white text-[11px] font-bold px-2 py-1 rounded-full">Popular</span>
            <div className="text-4xl">🏷️</div>
            <h3 className="font-black text-lg mt-3">Nota de Venta RIMPE</h3>
            <p className="text-slate-500 text-sm mt-1">Ideal para contribuyentes RIMPE, simple y conforme</p>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm border text-center hover:shadow-xl hover:-translate-y-1 transition">
            <div className="text-4xl">☁️</div>
            <h3 className="font-black text-lg mt-3">Sistema en la Nube</h3>
            <p className="text-slate-500 text-sm mt-1">Accede desde cualquier lugar, 100% online y seguro</p>
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs mt-10">© 2026 MEJISAC • Quito, Ecuador • Hecho con 💙 para tu negocio</p>
      </main>
    </div>
  );
}