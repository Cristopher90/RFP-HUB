// RFP HUB logo (orbit with connected suppliers + wordmark). Drawn inline so it
// follows the active theme color and light/dark mode instead of fixed colors.
// The original file lives in public/rfp-hub-logo-orbita.svg.
export function AppLogo({ height = 36, className }: { height?: number; className?: string }) {
  const font = "var(--font-geist-sans), Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 420 140"
      height={height}
      width={(height * 420) / 140}
      role="img"
      aria-label="RFP HUB"
      className={className}
    >
      <circle cx="70" cy="70" r="52" fill="none" strokeWidth="5" style={{ stroke: "var(--color-violet-300, #C4B5FD)" }} />
      <circle cx="70" cy="18" r="8" style={{ fill: "var(--color-violet-600, #7C3AED)" }} />
      <circle cx="122" cy="70" r="8" style={{ fill: "var(--color-violet-400, #A78BFA)" }} />
      <circle cx="70" cy="122" r="8" style={{ fill: "var(--color-violet-600, #7C3AED)" }} />
      <circle cx="18" cy="70" r="8" style={{ fill: "var(--color-violet-400, #A78BFA)" }} />
      <circle cx="70" cy="70" r="32" style={{ fill: "var(--color-violet-600, #7C3AED)" }} />
      <text x="70" y="77" textAnchor="middle" fontSize="19" fontWeight="800" letterSpacing="0.5" fill="#FFFFFF" style={{ fontFamily: font }}>
        RFP
      </text>
      <text x="152" y="88" fontSize="52" letterSpacing="1" fontWeight="700" style={{ fontFamily: font }}>
        <tspan style={{ fill: "var(--color-slate-900, #1E1B4B)" }}>RFP</tspan>
        <tspan dx="12" style={{ fill: "var(--color-violet-600, #7C3AED)" }}>
          HUB
        </tspan>
      </text>
    </svg>
  );
}
