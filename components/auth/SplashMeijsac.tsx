"use client"
import { motion } from "framer-motion"

export function SplashMeijsac({ dark }: { dark: boolean }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden ${dark ? "bg-[#020d14]" : "bg-[#f0fffe]"}`}>
      <motion.div
        initial={{ x: "-35vw", y: 90, rotate: -18, scale: 0.85 }}
        animate={{ x: "32vw", y: -70, rotate: 12, scale: 1.15 }}
        transition={{ duration: 5.8, ease: "easeInOut" }}
        className="absolute"
      >
        <img src="/colibri.png" alt="colibri" className="w-36 h-36 object-contain drop-shadow-[0_0_28px_#00f5d4]" />
      </motion.div>

      <div className="flex flex-col items-center z-10 px-6">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 1.4 }}
          className="text-4xl sm:text-5xl font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-[#00f5d4] to-[#ff00a8]"
        >
          MEIJSAC
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1.2 }}
          className={`text-xs tracking-[0.4em] mt-3 ${dark ? "text-white/70" : "text-black/60"}`}
        >
          POS • BAJO NORMAS SRI ECUADOR
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6, duration: 1 }}
          className={`text-[11px] tracking-[0.25em] mt-6 ${dark ? "text-[#00f5d4]/80" : "text-[#008f82]"}`}
        >
          BIENVENIDO
        </motion.p>
      </div>
    </div>
  )
}
