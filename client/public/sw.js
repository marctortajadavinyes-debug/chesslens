/* ChessLens service worker — Fase 1 PWA
 *
 * Reglas estrictas:
 *  - NUNCA cachear /api/*
 *  - NUNCA interceptar peticiones que no sean GET
 *  - NUNCA cachear OCR, PGN, partidas ni respuestas de backend
 *  - Ante la duda, network-only
 *
 * Solo cacheamos el app shell (HTML de navegación y assets estáticos del build).
 */

const CACHE_VERSION = "chesslens-v2";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const APP_SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          APP_SHELL_URLS.map((url) =>
            cache
              .add(new Request(url, { cache: "reload" }))
              .catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.png"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Regla 1: solo GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Regla 2: jamás tocar /api/*
  if (isApiRequest(url)) return;

  // Regla 3: solo mismo origen
  if (!isSameOrigin(url)) return;

  // Navegaciones (HTML): network-first con fallback al shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/", { ignoreSearch: true }).then(
          (cached) =>
            cached ||
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            }),
        ),
      ),
    );
    return;
  }

  // Assets estáticos: stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === "basic") {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => undefined);
        return cached || (await network) || Response.error();
      }),
    );
    return;
  }

  // Cualquier otra cosa: network-only (sin tocar nada)
});
