import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RFP.HUB",
  description: "Genera RFPs, invita proveedores, compara y adjudica cotizaciones.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const supplierUser = user ? null : await getCurrentSupplierUser();
  const client = user?.client ?? supplierUser?.client ?? null;
  const brandName = client?.description ?? null;
  const brandIcon = client?.icon || "🔨";

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,49,222,0.10),rgba(99,49,222,0))]"
        />
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-500 text-sm shadow-sm shadow-violet-600/30">
                {brandIcon}
              </span>
              <span className="text-lg font-semibold tracking-tight text-slate-900">
                {brandName && <span>{brandName} </span>}
                <span className="text-violet-600">RFP.HUB</span>
              </span>
            </Link>
            <HeaderNav />
          </div>
        </header>
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1">{children}</main>
        </div>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          RFP.HUB &middot; herramienta de compras y sourcing &middot; datos de demostración
        </footer>
      </body>
    </html>
  );
}
