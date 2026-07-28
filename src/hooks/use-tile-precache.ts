import { useEffect, useRef, useState } from "react";
import { TIRANA_CENTER } from "@/data/tirana-bus-data.ts";

const TILE_URL_TEMPLATE = "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

// Pre-cache tiles for zoom levels 12–15 around central Tirana
const PRECACHE_ZOOM_LEVELS = [12, 13, 14, 15];

// Tirana city center bounds (approximate)
const BOUNDS = {
  north: 41.38,
  south: 41.28,
  west: 19.76,
  east: 19.88,
};

const PRECACHE_STORAGE_KEY = "tiles-precached-v1";

/** Convert lat/lng to tile x,y at a given zoom level */
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Generate tile URLs for the Tirana city center area at given zoom levels */
function generateTileUrls(): string[] {
  const urls: string[] = [];

  for (const zoom of PRECACHE_ZOOM_LEVELS) {
    const topLeft = latLngToTile(BOUNDS.north, BOUNDS.west, zoom);
    const bottomRight = latLngToTile(BOUNDS.south, BOUNDS.east, zoom);

    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        urls.push(
          TILE_URL_TEMPLATE.replace("{z}", String(zoom))
            .replace("{x}", String(x))
            .replace("{y}", String(y)),
        );
      }
    }
  }

  return urls;
}

export type TileCacheStatus = "idle" | "caching" | "done" | "unavailable";

/**
 * Pre-caches map tiles for the Tirana city center area.
 * Only runs once (tracked via localStorage).
 * Sends tile URLs to the service worker in the background.
 */
export function useTilePrecache() {
  const [status, setStatus] = useState<TileCacheStatus>("idle");
  const [progress, setProgress] = useState<{ cached: number; total: number } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!("serviceWorker" in navigator)) {
      setStatus("unavailable");
      return;
    }

    // Check if we already precached
    const alreadyCached = localStorage.getItem(PRECACHE_STORAGE_KEY);
    if (alreadyCached) {
      setStatus("done");
      return;
    }

    started.current = true;

    // Wait for the service worker to be ready
    navigator.serviceWorker.ready.then((registration) => {
      const urls = generateTileUrls();
      setStatus("caching");
      setProgress({ cached: 0, total: urls.length });

      // Listen for completion message from SW
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "TILES_PRECACHED") {
          setProgress({ cached: event.data.cached, total: event.data.total });
          setStatus("done");
          localStorage.setItem(PRECACHE_STORAGE_KEY, new Date().toISOString());
          navigator.serviceWorker.removeEventListener("message", handler);
        }
      };
      navigator.serviceWorker.addEventListener("message", handler);

      // Send precache request to SW
      if (registration.active) {
        registration.active.postMessage({ type: "PRECACHE_TILES", urls });
      }
    });
  }, []);

  return { status, progress };
}
