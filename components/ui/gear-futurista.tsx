"use client"
import { useState } from "react"

export default function GearFuturista({ size = 140 }: { size?: number }) {
  const [active, setActive] = useState(false)
  return (
    <button
      onClick={() => setActive(!active)}
      className={`grid place-items-center rounded-full border-0 bg-transparent transition-all
        ${active ? 'bg-[rgba(84,228,237,0.09)] shadow-[0_0_0_1px_rgba(84,228,237,0.4),0_0_34px_rgba(84,228,237,0.16)]' : 'hover:bg-[rgba(84,228,237,0.045)]'}`}
      style={{ width: size, height: size }}
      aria-pressed={active}
    >
      <svg viewBox="0 0 200 200" className={`w-[80%] h-[80%] transition-all duration-[1150ms] ${active ? 'rotate-45' : 'hover:rotate-[42deg]'}`} style={{ filter: active ? 'drop-shadow(0 0 18px rgba(84,228,237,0.75)) brightness(1.23)' : 'drop-shadow(0 0 8px rgba(84,228,237,0.25))' }}>
        <defs>
          <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a5f6f1"/><stop offset=".48" stopColor="#57dce6"/><stop offset="1" stopColor="#278ca7"/></linearGradient>
          <radialGradient id="core"><stop stopColor="#efffff"/><stop offset=".4" stopColor="#a1fff3"/><stop offset="1" stopColor="#30b9ce"/></radialGradient>
        </defs>
        <path d="M88 16H112L116 31 129 36 142 28 159 45 151 58 156 71 171 75 171 99 156 103 151 116 159 129 142 146 129 138 116 143 112 158 88 158 84 143 71 138 58 146 41 129 49 116 44 103 29 99 29 75 44 71 49 58 41 45 58 28 71 36 84 31Z" transform="translate(0 13)" fill="#112d35" stroke="url(#metal)" strokeWidth="5" strokeLinejoin="round"/>
        <circle cx="100" cy="100" r="58" fill="none" stroke="#5ad5de" strokeOpacity=".46" strokeWidth="1.5"/>
        <circle cx="100" cy="100" r="47" fill="#153842" stroke="url(#metal)" strokeWidth="3"/>
        <circle cx="100" cy="100" r="36" fill="none" stroke="#8cecf0" strokeOpacity=".42" strokeWidth="1.5" strokeDasharray="8 6"/>
        <g fill="none" stroke="#79e6e8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M100 53v14l-8 8M147 100h-14l-8-8M100 147v-14l8-8M53 100h14l8 8"/></g>
        <circle cx="100" cy="100" r="22" fill="#0d2831" stroke="#79e9eb" strokeWidth="2.5"/>
        <circle cx="100" cy="100" r="14" fill="url(#core)"/>
        <circle cx="96" cy="96" r="4" fill="#f2ffff" opacity=".9"/>
      </svg>
    </button>
  )
}