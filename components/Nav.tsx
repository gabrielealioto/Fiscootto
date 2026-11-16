"use client";

import { FileText, LayoutDashboard, Plus, Settings, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { openMenu } from "./QuickActions";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pianifica", label: "Pianifica", icon: Target },
  { href: "/reports", label: "Report", icon: FileText },
  { href: "/settings", label: "Impostazioni", icon: Settings },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

export function SidebarNav() {
  const isActive = useActive();
  return (
    <nav className="stack" style={{ gap: 2 }}>
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={`nav-link ${isActive(href) ? "active" : ""}`}>
          <Icon size={19} /> {label}
        </Link>
      ))}
    </nav>
  );
}

/** Barra di navigazione in basso, solo su telefono. */
export function TabBar() {
  const isActive = useActive();
  const [dash, plan, reports, settings] = LINKS;
  const tab = (l: (typeof LINKS)[number]) => (
    <Link href={l.href} className={`tab ${isActive(l.href) ? "active" : ""}`}>
      <l.icon size={21} />
      {l.label}
    </Link>
  );
  return (
    <nav className="tabbar" aria-label="Navigazione">
      {tab(dash)}
      {tab(plan)}
      <button className="tab-add" onClick={openMenu} aria-label="Aggiungi">
        <Plus size={24} strokeWidth={2.4} />
      </button>
      {tab(reports)}
      {tab(settings)}
    </nav>
  );
}
