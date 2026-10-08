// Friendly analyst robot for the Reports screen. Colors follow the theme
// (violet scale + slate), so it adapts to every accent and to dark mode.
export function RobotMascot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 190" className={className} role="img" aria-label="Robot">
      {/* antenna */}
      <line x1="80" y1="14" x2="80" y2="30" className="stroke-slate-400" strokeWidth="4" strokeLinecap="round" />
      <circle cx="80" cy="10" r="7" className="fill-amber-400" />
      {/* head */}
      <rect x="30" y="30" width="100" height="70" rx="22" className="fill-violet-600" />
      <rect x="40" y="40" width="80" height="50" rx="14" className="fill-slate-900" />
      {/* eyes */}
      <circle cx="62" cy="62" r="9" className="fill-violet-300" />
      <circle cx="98" cy="62" r="9" className="fill-violet-300" />
      <circle cx="64" cy="60" r="3.5" className="fill-white" />
      <circle cx="100" cy="60" r="3.5" className="fill-white" />
      {/* smile */}
      <path d="M64 78 Q80 90 96 78" fill="none" className="stroke-violet-300" strokeWidth="4" strokeLinecap="round" />
      {/* ears */}
      <rect x="18" y="52" width="12" height="26" rx="6" className="fill-violet-800" />
      <rect x="130" y="52" width="12" height="26" rx="6" className="fill-violet-800" />
      {/* neck */}
      <rect x="68" y="100" width="24" height="10" className="fill-slate-400" />
      {/* body */}
      <rect x="28" y="108" width="104" height="62" rx="18" className="fill-violet-500" />
      {/* chest screen with a mini chart */}
      <rect x="44" y="118" width="72" height="42" rx="8" className="fill-slate-900" />
      <rect x="54" y="138" width="9" height="14" rx="2" className="fill-emerald-400" />
      <rect x="68" y="130" width="9" height="22" rx="2" className="fill-violet-300" />
      <rect x="82" y="134" width="9" height="18" rx="2" className="fill-amber-400" />
      <rect x="96" y="124" width="9" height="28" rx="2" className="fill-emerald-400" />
      {/* arms */}
      <rect x="10" y="116" width="14" height="40" rx="7" className="fill-violet-700" />
      <rect x="136" y="116" width="14" height="40" rx="7" className="fill-violet-700" />
      {/* feet */}
      <rect x="44" y="170" width="26" height="14" rx="7" className="fill-slate-500" />
      <rect x="90" y="170" width="26" height="14" rx="7" className="fill-slate-500" />
    </svg>
  );
}
