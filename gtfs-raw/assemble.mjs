import fs from "fs";

const routes = JSON.parse(fs.readFileSync("gtfs-raw/bus-routes.json", "utf8"));
const tail = fs.readFileSync("gtfs-raw/data-tail.ts", "utf8");

const header = `// Tirana Bus Route Data
// Sourced from the official GTFS feed published by the Municipality of Tirana,
// Department of Transportation and Road Traffic: https://pt.tirana.al/gtfs/gtfs.zip
// License: CC-BY-SA-4.0 — see the About/Credits screen for attribution.
//
// Regenerate with: python3 gtfs-raw/build_data.py && node gtfs-raw/assemble.mjs
// Generated: ${new Date().toISOString().slice(0, 10)}

export type BusStop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  // Minutes of travel from the previous stop (null for the first stop)
  travelMinutes: number | null;
};

export type BusRoute = {
  id: string;
  number: string;
  name: string;
  color: string;
  description: string;
  frequency: string;         // display string e.g. "10–15 min"
  frequencyMinutes: number;  // average minutes between buses (for schedule generation)
  operatingHours: string;
  firstDeparture: string;    // "HH:MM" from first stop
  lastDeparture: string;     // "HH:MM" from first stop
  stops: BusStop[];
  /** Real road-following polyline from the GTFS shapes.txt feed, [lat, lng] pairs. */
  shape: [number, number][];
};

// Central Tirana landmarks (lat/lng anchors)
// Sheshi Skënderbej: 41.3275, 19.8187
// Train Station (Stacioni i Trenit): 41.3362, 19.8201
// TEG Mall: 41.3453, 19.7667
// City Park (Parku i Madh): 41.3296, 19.8052

export const BUS_ROUTES: BusRoute[] = ${JSON.stringify(routes, null, 2)};

`;

fs.writeFileSync("src/data/tirana-bus-data.ts", header + tail);
console.log("Wrote src/data/tirana-bus-data.ts —", routes.length, "routes");
