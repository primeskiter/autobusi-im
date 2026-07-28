import { useEffect, useState } from "react";
import type { BusRoute } from "@/data/tirana-bus-data.ts";

type RouteGeometry = {
  routeId: string;
  coordinates: [number, number][]; // [lat, lng][]
};

// Cache to avoid re-fetching on re-renders
const geometryCache = new Map<string, [number, number][]>();

/**
 * Fetches road-snapped geometry from OSRM for a given set of waypoints.
 * Returns array of [lat, lng] pairs following actual roads.
 */
async function fetchRoadGeometry(stops: Array<{ lat: number; lng: number }>): Promise<[number, number][] | null> {
  if (stops.length < 2) return null;

  // OSRM expects coordinates as lng,lat pairs separated by semicolons
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json() as {
      code: string;
      routes?: Array<{ geometry: { coordinates: [number, number][] } }>;
    };

    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    // GeoJSON coordinates are [lng, lat] — flip to [lat, lng] for Leaflet
    const geojsonCoords = data.routes[0].geometry.coordinates;
    return geojsonCoords.map(([lng, lat]) => [lat, lng] as [number, number]);
  } catch {
    return null;
  }
}

/**
 * Hook that fetches and caches road-snapped geometries for all bus routes.
 * Returns a Map of routeId → [lat, lng][] positions.
 */
export function useRoadGeometries(routes: BusRoute[]): Map<string, [number, number][]> {
  const [geometries, setGeometries] = useState<Map<string, [number, number][]>>(() => {
    // Initialize from cache
    const initial = new Map<string, [number, number][]>();
    for (const route of routes) {
      const cached = geometryCache.get(route.id);
      if (cached) initial.set(route.id, cached);
    }
    return initial;
  });

  useEffect(() => {
    let cancelled = false;

    async function loadGeometries() {
      // Find routes that need fetching
      const toFetch = routes.filter((r) => !geometryCache.has(r.id));
      if (toFetch.length === 0) return;

      // Batch requests with a small delay to avoid rate limiting
      for (let i = 0; i < toFetch.length; i++) {
        if (cancelled) break;
        const route = toFetch[i]!;

        const coords = await fetchRoadGeometry(route.stops);
        if (cancelled) break;

        if (coords) {
          geometryCache.set(route.id, coords);
          setGeometries((prev) => {
            const next = new Map(prev);
            next.set(route.id, coords);
            return next;
          });
        }

        // Small delay between requests to be polite to the OSRM server
        if (i < toFetch.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    }

    loadGeometries();
    return () => { cancelled = true; };
  }, [routes]);

  return geometries;
}

export type { RouteGeometry };
