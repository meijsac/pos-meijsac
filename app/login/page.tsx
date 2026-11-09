"use client";
import { useState, useEffect } from "react";
import { SplashMeijsac } from "@/components/auth/SplashMeijsac";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterEmpresa } from "@/components/auth/RegisterEmpresa";
import { EsisaAvatar } from "@/components/EsisaAvatar";

export default function HomePage() {
  const [mostrarSplash, setMostrarSplash] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Volvemos a tu original, sin ThemeProvider
  const dark = true;

  const setDark = () => {};

  useEffect(() => {
    const timer = setTimeout(() => {
      setMostrarSplash(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  if (mostrarSplash) {
    return <SplashMeijsac dark={dark} />;
  }

  return (
    <main className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-500 ${dark ? "bg-[#070a12]" : "bg-[#f0fffe]"}`}>
      {!isRegistering ? (
        <AuthCard 
          dark={dark} 
          setDark={setDark} 
          onOpenRegister={() => setIsRegistering(true)} 
        />
      ) : (
        <div className={`w-full max-w-[420px] p-7 rounded-[32px] border shadow-2xl transition-all ${dark ? "bg-[#101a2e]/90 border-cyan-400/20 text-white" : "bg-white border-black/10 text-black"}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[#00f5d4] font-black text-[13px] tracking-wider">ASISTENTE DE REGISTRO - SRI</h2>
            <button 
              onClick={() => setIsRegistering(false)}
              className="text-[10px] bg-white/10 px-2.5 py-1 rounded-full hover:bg-red-500/20 hover:text-red-400 transition"
            >
              ✕ Volver
            </button>
          </div>
          <RegisterEmpresa 
            dark={dark} 
            setTipo={(val: string) => { if(val === "principal") setIsRegistering(false); }} 
          />
        </div>
      )}
      <EsisaAvatar />
    </main>
  );
}