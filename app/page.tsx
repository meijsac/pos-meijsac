import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6f8fa] text-[#0a2a4a]">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
           <img src="/colibri2.png" alt="MEJISAC" className="w-9 h-9 object-contain" />
            <span className="text-2xl font-black tracking-tight">MEJISAC</span>
          </div>
          <Link href="/login" className="bg-[#0a2a4a] text-white px-4 py-2 rounded-md font-bold text-sm">
            Ingresar al Sistema
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight">
              Facturación<br/>Electrónica sin<br/>complicaciones
            </h1>
            <p className="mt-4 text-gray-600">
              Para tu negocio en Ecuador, <b>Factura, Nota de Venta RIMPE</b> y WhatsApp en un solo lugar.
            </p>
            <div className="flex gap-3 mt-6">
              <Link href="/login" className="bg-blue-600 text-white px-5 py-3 rounded-md font-bold">
                Empezar Ahora →
              </Link>
              <a href="https://wa.me/593999999999" target="_blank" className="bg-green-500 text-white px-5 py-3 rounded-md font-bold">
                WhatsApp
              </a>
            </div>
          </div>
          <div className="bg-[#0a2a4a] rounded-2xl p-10 text-center text-white">
            <div className="flex justify-center"><img src="/colibri2.png" alt="Colibrí MEJISAC" className="w-48 h-48 object-contain mx-auto" /></div>
            <p className="mt-2 font-bold">MEJISAC - Tu colibrí factura por ti</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-10">
          <div className="bg-white p-6 rounded-xl shadow text-center">
            <div className="text-3xl">📄</div>
            <h3 className="font-black text-lg mt-2">Facturación Electrónica</h3>
            <p className="text-sm text-gray-600 mt-1">Emite comprobantes válidos al SRI de forma rápida y segura</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow text-center">
            <div className="text-3xl">🏷️</div>
            <h3 className="font-black text-lg mt-2">Nota de Venta RIMPE <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">Popular</span></h3>
            <p className="text-sm text-gray-600 mt-1">Ideal para contribuyentes RIMPE, simple y conforme</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow text-center">
            <div className="text-3xl">☁️</div>
            <h3 className="font-black text-lg mt-2">Sistema en la Nube</h3>
            <p className="text-sm text-gray-600 mt-1">Accede desde cualquier lugar, 100% online y seguro</p>
          </div>
        </div>
      </main>
    </div>
  );
}