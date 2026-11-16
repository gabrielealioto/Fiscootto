import "@fontsource-variable/inter";
import { LogOut } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { Logo } from "@/components/Logo";
import { SidebarNav, TabBar } from "@/components/Nav";
import { InstallButton, ServiceWorkerRegister } from "@/components/Pwa";
import { QuickActionsHost } from "@/components/QuickActions";
import { fetchSettings } from "@/lib/data";
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
  viewportFit: "cover",
  themeColor: "#070a09",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const regime = user ? (await fetchSettings(supabase)).regime ?? "forfettario" : "forfettario";

  return (
    <html lang="it">
      <body>
        {user ? (
          <div className="app">
            <aside className="sidebar">
              <Logo />
              <SidebarNav />
              <div className="sidebar-foot">
                <InstallButton />
                <div className="user-chip">
                  <span className="avatar">{(user.email ?? "?").charAt(0)}</span>
                  <span className="user-email" title={user.email ?? ""}>
                    {user.email}
                  </span>
                  <form action="/auth/signout" method="post" style={{ marginLeft: "auto" }}>
                    <button className="btn btn-ghost btn-icon" type="submit" aria-label="Esci" title="Esci">
                      <LogOut size={17} />
                    </button>
                  </form>
                </div>
              </div>
            </aside>
            <main className="main">
              <header className="mobile-top">
                <Logo size={16} />
                <div className="row" style={{ gap: 4 }}>
                  <InstallButton compact />
                  <form action="/auth/signout" method="post">
                    <button className="btn btn-ghost btn-icon" type="submit" aria-label="Esci">
                      <LogOut size={18} />
                    </button>
                  </form>
                </div>
              </header>
              {children}
            </main>
            <TabBar />
            <QuickActionsHost regime={regime} />
          </div>
        ) : (
          children
        )}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
