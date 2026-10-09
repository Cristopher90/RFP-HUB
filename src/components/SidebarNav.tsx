"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SidebarIconName = "home" | "rfps" | "requests" | "reports" | "settings" | "systemTables" | "emailLog";

// Hand-drawn line icons, one per menu entry, drawn with currentColor so they
// follow the theme and the active/hover state.
function Icon({ name }: { name: SidebarIconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "home": // house
      return (
        <svg {...common}>
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6 10.5V20h12v-9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case "rfps": // sheet of paper with lines and a check: a request for proposal
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6M9 15h6" />
          <path d="m9 18.2 1.2 1.2 2.3-2.4" />
        </svg>
      );
    case "requests": // shopping cart: purchase requests
      return (
        <svg {...common}>
          <path d="M3 4h2l2.4 11h10.2l2-8H6.2" />
          <circle cx="9.5" cy="19" r="1.5" />
          <circle cx="16.5" cy="19" r="1.5" />
        </svg>
      );
    case "reports": // bar chart
      return (
        <svg {...common}>
          <path d="M4 4v16h16" />
          <path d="M8 16v-5M12 16V8M16 16v-8" strokeWidth={2.6} />
        </svg>
      );
    case "settings": // sliders
      return (
        <svg {...common}>
          <path d="M4 7h8M18 7h2M4 12h2M12 12h8M4 17h10M20 17h0" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );
    case "systemTables": // database
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="8" ry="3" />
          <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
          <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
        </svg>
      );
    case "emailLog": // envelope
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
  }
}

export type SidebarItem = { href: string; label: string; icon: SidebarIconName };

export function SidebarNav({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();
  // The most specific matching entry is the active one (so "Configuración" at
  // /admin is not also active on /admin/system-tables).
  const active = items
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="sticky top-[73px] flex flex-col gap-1 px-3 py-6 text-sm font-medium">
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
              isActive
                ? "bg-violet-50 text-violet-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span className={isActive ? "text-violet-600" : "text-violet-500"}>
              <Icon name={item.icon} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
