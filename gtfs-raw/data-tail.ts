export const TIRANA_CENTER: [number, number] = [41.3275, 19.8187];

// ─── Schedule helpers ────────────────────────────────────────────────────────

/** Parse "HH:MM" into total minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Format total minutes since midnight to "HH:MM" */
function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Returns the cumulative travel minutes from the first stop to each stop index.
 * Index 0 is always 0.
 */
export function getCumulativeTravelMinutes(route: BusRoute): number[] {
  const result: number[] = [0];
  for (let i = 1; i < route.stops.length; i++) {
    const prev = result[i - 1] ?? 0;
    result.push(prev + (route.stops[i]?.travelMinutes ?? 3));
  }
  return result;
}

/**
 * Returns upcoming departure times (HH:MM strings) from a given stop index,
 * relative to the current time. Returns up to `count` departures.
 */
export function getUpcomingDepartures(
  route: BusRoute,
  stopIndex: number,
  count = 5
): string[] {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const cumulative = getCumulativeTravelMinutes(route);
  const offsetAtStop = cumulative[stopIndex] ?? 0;

  const firstMin = timeToMinutes(route.firstDeparture);
  const lastMin = timeToMinutes(route.lastDeparture);
  const freq = route.frequencyMinutes;

  const departures: string[] = [];

  // Departures from the first stop; arrival at our stop = departure + offset
  let departure = firstMin;
  while (departure <= lastMin && departures.length < count * 3) {
    const arrivalAtStop = departure + offsetAtStop;
    if (arrivalAtStop >= nowMinutes) {
      departures.push(minutesToTime(arrivalAtStop));
    }
    departure += freq;
  }

  return departures.slice(0, count);
}

export type DepartureCountdown = {
  /** Minutes until the bus arrives at this stop */
  minutesAway: number;
  /** Absolute arrival time as "HH:MM" */
  time: string;
};

/**
 * Returns countdown data (minutes until arrival) for upcoming departures
 * at a given stop. Used for live countdown displays.
 */
export function getUpcomingDepartureCountdowns(
  route: BusRoute,
  stopIndex: number,
  count = 4
): DepartureCountdown[] {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const cumulative = getCumulativeTravelMinutes(route);
  const offsetAtStop = cumulative[stopIndex] ?? 0;

  const firstMin = timeToMinutes(route.firstDeparture);
  const lastMin = timeToMinutes(route.lastDeparture);
  const freq = route.frequencyMinutes;

  const results: DepartureCountdown[] = [];

  let departure = firstMin;
  while (departure <= lastMin && results.length < count * 3) {
    const arrivalAtStop = departure + offsetAtStop;
    const minutesAway = arrivalAtStop - nowMinutes;
    if (minutesAway >= 0) {
      results.push({
        minutesAway,
        time: minutesToTime(arrivalAtStop),
      });
    }
    departure += freq;
  }

  return results.slice(0, count);
}

/**
 * Finds all routes that serve a given stop name (exact match).
 */
export function getRoutesForStop(stopName: string): Array<{ route: BusRoute; stopIndex: number }> {
  const results: Array<{ route: BusRoute; stopIndex: number }> = [];
  const q = stopName.toLowerCase();
  for (const route of BUS_ROUTES) {
    const idx = route.stops.findIndex((s) => s.name.toLowerCase() === q);
    if (idx !== -1) results.push({ route, stopIndex: idx });
  }
  return results;
}

// ─── Areas / Zones ────────────────────────────────────────────────────────────

export type Area = {
  id: string;
  label: string;
  /** Keywords that appear in stop names or route descriptions for this area */
  keywords: string[];
};

export const AREAS: Area[] = [
  { id: "center",   label: "City Center",  keywords: ["skënderbej", "blloku", "qendër", "kavajës", "durrësit"] },
  { id: "north",    label: "North",        keywords: ["kamëz", "bathore", "lapraka", "laprakë", "fresku", "institut", "shkoza"] },
  { id: "east",     label: "East",         keywords: ["allias", "kodra e diellit", "porcelan", "elbasanit", "materniteti", "sauk"] },
  { id: "west",     label: "West",         keywords: ["kashar", "yzberisht", "teg", "city park"] },
  { id: "south",    label: "South",        keywords: ["kombinat", "sharrë", "selitë", "terminali juglindor", "zall"] },
  { id: "airport",  label: "Airport",      keywords: ["aeroporti", "rinas", "autostrada"] },
];

/** Returns the area ids that a route serves */
export function getRouteAreas(route: BusRoute): string[] {
  const stopText = route.stops.map((s) => s.name.toLowerCase()).join(" ");
  const descText = (route.name + " " + route.description).toLowerCase();
  return AREAS.filter((area) =>
    area.keywords.some((kw) => stopText.includes(kw) || descText.includes(kw))
  ).map((a) => a.id);
}

// ─── Trip Planner ─────────────────────────────────────────────────────────────

export type TripLeg = {
  route: BusRoute;
  boardStopIndex: number;
  alightStopIndex: number;
  boardStop: BusStop;
  alightStop: BusStop;
  travelMinutes: number;
};

export type TripOption = {
  legs: TripLeg[];
  totalMinutes: number;
  transfers: number;
  /** Names of transfer stops */
  transferStops: string[];
};

/**
 * Build a lookup: stop-name → list of { route, stopIndex }
 */
function buildStopIndex(): Map<string, Array<{ route: BusRoute; stopIndex: number }>> {
  const index = new Map<string, Array<{ route: BusRoute; stopIndex: number }>>();
  for (const route of BUS_ROUTES) {
    route.stops.forEach((stop, idx) => {
      const key = stop.name.toLowerCase();
      const arr = index.get(key) ?? [];
      arr.push({ route, stopIndex: idx });
      index.set(key, arr);
    });
  }
  return index;
}

const STOP_INDEX = buildStopIndex();

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find stops whose name fuzzy-matches a query string (case-insensitive substring).
 * Returns unique stop names sorted by relevance.
 */
export function fuzzyMatchStops(query: string, limit = 8): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const seen = new Set<string>();
  const results: string[] = [];
  for (const route of BUS_ROUTES) {
    for (const stop of route.stops) {
      if (!seen.has(stop.name) && stop.name.toLowerCase().includes(q)) {
        seen.add(stop.name);
        results.push(stop.name);
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}

/** All unique stop names */
export function getAllStopNames(): string[] {
  const seen = new Set<string>();
  for (const route of BUS_ROUTES) {
    for (const stop of route.stops) seen.add(stop.name);
  }
  return [...seen].sort();
}

/**
 * Compute travel minutes between two stop indices on the same route
 * using the cumulative array.
 */
function legMinutes(route: BusRoute, from: number, to: number): number {
  const cum = getCumulativeTravelMinutes(route);
  return (cum[to] ?? 0) - (cum[from] ?? 0);
}

/**
 * Plan trips between two stop names.
 * Returns up to 3 options (direct, then 1-transfer options sorted by time).
 */
export function planTrip(originName: string, destinationName: string): TripOption[] {
  const origKey = originName.toLowerCase();
  const destKey = destinationName.toLowerCase();

  const origEntries = STOP_INDEX.get(origKey) ?? [];
  const destEntries = STOP_INDEX.get(destKey) ?? [];

  if (!origEntries.length || !destEntries.length) return [];

  const options: TripOption[] = [];
  const seen = new Set<string>();

  // ── Direct routes ──────────────────────────────────────────────────────────
  for (const { route: r, stopIndex: fromIdx } of origEntries) {
    for (const { route: r2, stopIndex: toIdx } of destEntries) {
      if (r.id !== r2.id) continue;
      if (fromIdx >= toIdx) continue; // wrong direction on this route
      const mins = legMinutes(r, fromIdx, toIdx);
      const key = `${r.id}:${fromIdx}:${toIdx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        legs: [
          {
            route: r,
            boardStopIndex: fromIdx,
            alightStopIndex: toIdx,
            boardStop: r.stops[fromIdx]!,
            alightStop: r.stops[toIdx]!,
            travelMinutes: mins,
          },
        ],
        totalMinutes: mins,
        transfers: 0,
        transferStops: [],
      });
    }
  }

  // ── 1-transfer routes ──────────────────────────────────────────────────────
  // For each origin route, find where it intersects with destination routes
  for (const { route: r1, stopIndex: fromIdx } of origEntries) {
    // Collect stops on r1 after fromIdx
    for (let xferIdx = fromIdx + 1; xferIdx < r1.stops.length; xferIdx++) {
      const xferStopName = r1.stops[xferIdx]!.name.toLowerCase();
      const xferEntries = STOP_INDEX.get(xferStopName) ?? [];

      for (const { route: r2, stopIndex: xferIdx2 } of xferEntries) {
        if (r2.id === r1.id) continue; // same route, skip
        // Check if r2 reaches dest
        for (const { route: r3, stopIndex: toIdx } of destEntries) {
          if (r3.id !== r2.id) continue;
          if (xferIdx2 >= toIdx) continue; // wrong direction
          const leg1 = legMinutes(r1, fromIdx, xferIdx);
          const leg2 = legMinutes(r2, xferIdx2, toIdx);
          const waitEstimate = Math.round(r2.frequencyMinutes / 2); // avg wait
          const total = leg1 + waitEstimate + leg2;
          const key = `${r1.id}:${fromIdx}:${xferIdx}|${r2.id}:${xferIdx2}:${toIdx}`;
          if (seen.has(key)) continue;
          seen.add(key);
          options.push({
            legs: [
              {
                route: r1,
                boardStopIndex: fromIdx,
                alightStopIndex: xferIdx,
                boardStop: r1.stops[fromIdx]!,
                alightStop: r1.stops[xferIdx]!,
                travelMinutes: leg1,
              },
              {
                route: r2,
                boardStopIndex: xferIdx2,
                alightStopIndex: toIdx,
                boardStop: r2.stops[xferIdx2]!,
                alightStop: r2.stops[toIdx]!,
                travelMinutes: leg2,
              },
            ],
            totalMinutes: total,
            transfers: 1,
            transferStops: [r1.stops[xferIdx]!.name],
          });
        }
      }
    }
  }

  // Sort: direct first, then by total time; cap at 3
  return options
    .sort((a, b) => a.transfers - b.transfers || a.totalMinutes - b.totalMinutes)
    .slice(0, 3);
}

/** Returns the nearest stop name to a given lat/lng */
export function getNearestStop(lat: number, lng: number): string {
  let best = { name: "", dist: Infinity };
  for (const route of BUS_ROUTES) {
    for (const stop of route.stops) {
      const d = haversineKm(lat, lng, stop.lat, stop.lng);
      if (d < best.dist) best = { name: stop.name, dist: d };
    }
  }
  return best.name;
}

export type NearbyStop = {
  stop: BusStop;
  distanceKm: number;
  walkingMinutes: number;
  routes: Array<{ route: BusRoute; stopIndex: number }>;
};

/**
 * Returns unique stops near a given lat/lng, sorted by distance.
 * Walking speed assumed ~5 km/h (12 min/km).
 */
export function getNearbyStops(lat: number, lng: number, maxKm = 1.5, limit = 10): NearbyStop[] {
  const seen = new Set<string>();
  const results: NearbyStop[] = [];

  // Collect all unique stops with distances
  for (const route of BUS_ROUTES) {
    for (const stop of route.stops) {
      if (seen.has(stop.name)) continue;
      seen.add(stop.name);
      const d = haversineKm(lat, lng, stop.lat, stop.lng);
      if (d <= maxKm) {
        const routes = getRoutesForStop(stop.name);
        results.push({
          stop,
          distanceKm: d,
          walkingMinutes: Math.round(d * 12),
          routes,
        });
      }
    }
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit);
}
