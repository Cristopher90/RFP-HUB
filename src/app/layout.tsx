import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans, Public_Sans, Sora } from "next/font/google";
import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";
import { Sidebar } from "@/components/Sidebar";
import { AppLogo } from "@/components/AppLogo";
import { getCurrentUser } from "@/lib/auth";
import { acceptedLinks, getCurrentSupplierUser } from "@/lib/supplierAuth";
import { formatDateTime } from "@/lib/format";
import { getViewerPreferences } from "@/lib/preferences";
import { getDictionary } from "@/i18n/getDictionary";
import { localeForLanguage } from "@/i18n/locale";
import { PreferencesProvider } from "@/i18n/PreferencesProvider";
import { DARK_COLOR_MODES, PALETTE_MODES, forcedUiMode, glassCssVars } from "@/lib/themes";
import { appEnv } from "@/lib/appEnv";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Fonts of the alternative interface styles; they only load when a style uses them.
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"], preload: false });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], preload: false });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], preload: false });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  return {
    title: appEnv() === "test" ? "[TEST] procureHub" : "procureHub",
    description: "Genera RFPs, invita proveedores, compara y adjudica cotizaciones.",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const supplierUser = user ? null : await getCurrentSupplierUser();
  // A supplier contact connected to a single client takes that client's
  // branding; connected to several, the neutral app branding.
  const supplierClients = supplierUser
    ? [...new Map(acceptedLinks(supplierUser).map((l) => [l.clientId, l.client])).values()]
    : [];
  const client = user?.client ?? (supplierClients.length === 1 ? supplierClients[0] : null);
  const brandName = client?.description ?? null;
  const brandIcon = client?.icon || "🔨";
  const brandImage = client?.iconImage ?? null;

  const activeSession = user ?? supplierUser;
  const sessionName = activeSession
    ? `${activeSession.name} ${activeSession.lastName ?? ""}`.trim()
    : null;

  const preferences = await getViewerPreferences();
  const dictionary = getDictionary(preferences.language);
  const locale = localeForLanguage(preferences.language);
  const sessionLoginLabel =
    activeSession?.lastLoginAt != null
      ? formatDateTime(activeSession.lastLoginAt, { locale, timeZone: preferences.timeZone })
      : null;

  return (
    <html
      lang={preferences.language}
      data-theme={preferences.theme}
      data-mode={
        forcedUiMode(preferences.uiStyle) ?? (DARK_COLOR_MODES.includes(preferences.colorMode) ? "dark" : "light")
      }
      data-palette={
        !forcedUiMode(preferences.uiStyle) && PALETTE_MODES.includes(preferences.colorMode)
          ? preferences.colorMode
          : undefined
      }
      data-color-mode={preferences.colorMode}
      data-ui={preferences.uiStyle}
      style={
        preferences.uiStyle === "cristal"
          ? (glassCssVars(preferences.uiGlass, preferences.uiBackground) as React.CSSProperties)
          : undefined
      }
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${publicSans.variable} ${sora.variable} ${jakarta.variable} h-full antialiased`}
    >
      <head>
        {/* "System" mode: follow the OS before first paint (and while it changes). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement;if(d.dataset.colorMode!=='system'||d.dataset.ui==='cristal'||d.dataset.ui==='panel')return;var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){d.dataset.mode=m.matches?'dark':'light'}a();m.addEventListener('change',a)})()",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {appEnv() === "test" && (
          <div className="bg-amber-400 px-4 py-1 text-center text-xs font-semibold text-amber-950">
            {dictionary.envBanner.test}
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(80%_60%_at_50%_-10%,color-mix(in_oklab,var(--color-violet-600)_12%,transparent),transparent)]"
        />
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-3">
            {/* Left: the client (icon + name), apart from the app's own logo. */}
            <div className="flex min-w-0 items-center">
              {client && (
                <Link href={user ? "/home" : "/"} className="flex min-w-0 items-center gap-2.5">
                  {brandImage ? (
                    // The client's own image replaces the emoji badge.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brandImage} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain shadow-sm" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-500 text-sm shadow-sm shadow-violet-600/30">
                      {brandIcon}
                    </span>
                  )}
                  {brandName && (
                    <span className="hidden truncate text-lg font-semibold tracking-tight text-slate-900 sm:inline">
                      {brandName}
                    </span>
                  )}
                </Link>
              )}
            </div>
            {/* Center: procureHub logo. */}
            <Link href={user ? "/home" : "/"} aria-label="procureHub" className="flex items-center">
              <AppLogo height={36} />
            </Link>
            <div className="flex justify-end">
              <HeaderNav />
            </div>
          </div>
        </header>
        <div className="flex flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <PreferencesProvider
              language={preferences.language}
              timeZone={preferences.timeZone}
              currency={preferences.currency}
              dictionary={dictionary}
            >
              {children}
            </PreferencesProvider>
          </main>
        </div>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          {dictionary.footer.tagline}
          {sessionName && (
            <>
              {" "}
              &middot; {sessionName}
              {sessionLoginLabel && (
                <>
                  {" "}
                  &middot; {dictionary.footer.sessionStarted}: {sessionLoginLabel}
                </>
              )}
            </>
          )}
        </footer>
      </body>
    </html>
  );
}
