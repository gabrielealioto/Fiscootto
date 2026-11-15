// Service worker di Fiscootto.
// Regola d'oro: in cache vanno solo file statici (JS, CSS, icone, pagina offline).
// Pagine con dati, API e richieste a Supabase passano sempre dalla rete e non vengono salvate.

const VERSION = "v1";
const STATIC_CACHE = `fiscootto-static-${VERSION}`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/offline.html")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navigazione: sempre dalla rete; senza connessione, pagina offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // File statici con hash nel nome: cache-first.
  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
  // Tutto il resto (API, Supabase, dati RSC): nessuna intercettazione.
});
