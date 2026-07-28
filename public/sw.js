const CACHE_VERSION = "v2";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Placeholder SVG tile shown when offline and tile not cached
const OFFLINE_TILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
  <rect width="256" height="256" fill="#e8e8e8"/>
  <text x="128" y="128" text-anchor="middle" dominant-baseline="middle"
    font-family="sans-serif" font-size="11" fill="#999">Offline</text>
</svg>`;

// Core shell assets to precache on install
const PRECACHE_URLS = [
  "/",
  "/icon/icon-192.png",
  "/icon/icon-512.png",
  "/site.webmanifest",
];

// File extensions that should use cache-first strategy
const CACHEABLE_EXTENSIONS = [
  ".js",
  ".css",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".ico",
  ".webp",
  ".avif",
];

/**
 * Determines if a request URL points to a static asset (cache-first).
 */
function isStaticAsset(url) {
  const pathname = url.pathname;
  // Vite hashed assets in /assets/ folder
  if (pathname.startsWith("/assets/")) return true;
  // Icon files
  if (pathname.startsWith("/icon/")) return true;
  // Files with cacheable extensions
  return CACHEABLE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            // Delete old versioned caches
            if (name !== STATIC_CACHE && name !== RUNTIME_CACHE) {
              return caches.delete(name);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // Never intercept auth paths
  if (url.pathname.startsWith("/auth")) return;

  // Never intercept Convex WebSocket or API calls
  if (url.hostname.includes("convex")) return;

  // Handle same-origin requests
  if (url.origin === self.location.origin) {
    // Navigation requests: network-first, fall back to cached index
    if (event.request.mode === "navigate") {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            // Cache the latest index.html
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put("/", clone));
            return response;
          })
          .catch(() => caches.match("/")),
      );
      return;
    }

    // Static assets: cache-first (fast offline loads)
    if (isStaticAsset(url)) {
      event.respondWith(
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
            }
            return response;
          });
        }),
      );
      return;
    }

    // Other same-origin: network-first, cache as fallback
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Cross-origin: map tiles and fonts — cache with runtime cache
  const isTileRequest =
    url.hostname.includes("basemaps.cartocdn.com") ||
    url.hostname.includes("tile.openstreetmap.org");
  const isFontRequest =
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com");

  if (isTileRequest || isFontRequest) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Return a grey placeholder tile when offline and tile isn't cached
            if (isTileRequest) {
              return new Response(OFFLINE_TILE_SVG, {
                headers: { "Content-Type": "image/svg+xml" },
              });
            }
            return new Response("", { status: 503 });
          });
      }),
    );
    return;
  }
});

// ─── Message handler (tile precaching, skip waiting) ─────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "PRECACHE_TILES") {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        let cached = 0;
        for (const url of urls) {
          // Skip if already cached
          const existing = await cache.match(url);
          if (existing) {
            cached++;
            continue;
          }
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
              cached++;
            }
          } catch {
            // Silently skip failed tiles
          }
        }
        // Notify the client about progress
        const clients = await self.clients.matchAll();
        for (const client of clients) {
          client.postMessage({
            type: "TILES_PRECACHED",
            total: urls.length,
            cached,
          });
        }
      }),
    );
    return;
  }
});

// ─── Push Notifications ──────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const isAppInFocus = clientList.some((client) => client.focused);
      if (!isAppInFocus) {
        return self.registration.showNotification(data.title, data.options);
      }
    }),
  );
});

// ─── Notification Clicks ─────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    }),
  );
});
