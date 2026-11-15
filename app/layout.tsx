import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { InstallButton, ServiceWorkerRegister } from "@/components/Pwa";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiscootto",
  description: "Controller finanziario per freelance in regime forfettario",
  applicationName: "Fiscootto",
  appleWebApp: { capable: true, title: "Fiscootto", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#111418" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="it">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>
              €
            </span>
            Fiscootto
          </Link>
          {user && (
            <nav className="nav">
              <Link href="/">Dashboard</Link>
              <Link href="/reports">Report salvati</Link>
              <Link href="/settings">Impostazioni</Link>
            </nav>
          )}
          <div className="topbar-right">
            <InstallButton />
            {user && (
              <form action="/auth/signout" method="post">
                <button className="btn btn-ghost btn-sm" type="submit" title={user.email ?? ""}>
                  Esci
                </button>
              </form>
            )}
          </div>
        </header>
        <main className="container">{children}</main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
