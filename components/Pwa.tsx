"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Registra il service worker (solo in produzione) e svuota le cache all'uscita. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (new URLSearchParams(location.search).has("signedout") && "caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }, []);
  return null;
}

/** Pulsante "Installa app": usa il prompt nativo dove esiste, istruzioni su iOS. */
export function InstallButton({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!deferred && !ios)) return null;

  if (deferred) {
    return (
      <button
        className={compact ? "btn btn-secondary btn-sm" : "btn btn-secondary btn-block"}
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
      >
        <Download size={16} /> {compact ? "Installa" : "Installa app"}
      </button>
    );
  }

  return (
    <div className="install-ios">
      <button
        className={compact ? "btn btn-secondary btn-sm" : "btn btn-secondary btn-block"}
        onClick={() => setShowHelp((v) => !v)}
        aria-expanded={showHelp}
      >
        <Download size={16} /> {compact ? "Installa" : "Installa app"}
      </button>
      {showHelp && (
        <div className="popover" role="dialog" style={compact ? { top: "calc(100% + 8px)", bottom: "auto", left: "auto", right: 0 } : undefined}>
          In Safari tocca <strong>Condividi</strong> e poi <strong>Aggiungi alla schermata Home</strong>.
        </div>
      )}
    </div>
  );
}
