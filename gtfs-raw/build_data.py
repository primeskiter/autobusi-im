import csv
import io
import json
import statistics
import zipfile
from collections import defaultdict
from datetime import date

ZIP_PATH = "gtfs-raw/gtfs.zip"
TODAY = int(date.today().strftime("%Y%m%d"))  # used to pick the currently-active weekday service

_zip = zipfile.ZipFile(ZIP_PATH)


def read_csv(name):
    with _zip.open(name) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        return list(csv.DictReader(text))


def open_csv_reader(name):
    """Streaming reader for large files (e.g. stop_times.txt) — avoids loading
    the whole file into memory as dict rows before we've filtered anything."""
    raw = _zip.open(name)
    text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
    return csv.DictReader(text)


def time_to_minutes(t):
    """GTFS times can exceed 24:00:00 for past-midnight trips."""
    h, m, s = t.split(":")
    return int(h) * 60 + int(m) + int(s) / 60


def minutes_to_hhmm(total_minutes):
    total_minutes = round(total_minutes)
    h = (total_minutes // 60) % 24
    m = total_minutes % 60
    return f"{h:02d}:{m:02d}"


# ── Load static tables ──────────────────────────────────────────────────────
routes_raw = read_csv("routes.txt")
stops_raw = read_csv("stops.txt")
trips_raw = read_csv("trips.txt")
calendar_raw = read_csv("calendar.txt")
shapes_raw = read_csv("shapes.txt")

stops_by_id = {s["stop_id"]: s for s in stops_raw}

# ── Pick the weekday service active today ───────────────────────────────────
candidates = [
    c for c in calendar_raw
    if c["monday"] == "1"
    and int(c["start_date"]) <= TODAY <= int(c["end_date"])
]
# Prefer a "normal" Mon-Fri pattern (mon..fri = 1, sat/sun = 0)
normal = [c for c in candidates if c["tuesday"] == "1" and c["saturday"] == "0" and c["sunday"] == "0"]
chosen_service = (normal or candidates)[0]["service_id"]
print(f"Using weekday service: {chosen_service}")

# ── Group trips by route, keep only the chosen service ──────────────────────
trips_by_route = defaultdict(list)
for t in trips_raw:
    if t["service_id"] == chosen_service:
        trips_by_route[t["route_id"]].append(t)

relevant_trip_ids = {t["trip_id"] for t in trips_raw if t["service_id"] == chosen_service}

# Fallback: routes with zero trips in the chosen service (shouldn't happen, but be safe)
all_trips_by_route = defaultdict(list)
for t in trips_raw:
    all_trips_by_route[t["route_id"]].append(t)
for rid, ts in all_trips_by_route.items():
    if not trips_by_route[rid]:
        trips_by_route[rid] = ts
        relevant_trip_ids.update(t["trip_id"] for t in ts)

# ── Single pass over stop_times.txt, keep only relevant trips ───────────────
stop_times_by_trip = defaultdict(list)
for row in open_csv_reader("stop_times.txt"):
    if row["trip_id"] in relevant_trip_ids:
        stop_times_by_trip[row["trip_id"]].append(row)

for trip_id in stop_times_by_trip:
    stop_times_by_trip[trip_id].sort(key=lambda r: int(r["stop_sequence"]))

# ── Group shape points ───────────────────────────────────────────────────────
shape_points = defaultdict(list)
for r in shapes_raw:
    shape_points[r["shape_id"]].append(r)
for sid in shape_points:
    shape_points[sid].sort(key=lambda r: int(r["shape_pt_sequence"]))


def natural_sort_key(short_name):
    import re
    m = re.match(r"(\d+)([A-Za-z]*)", short_name)
    if not m:
        return (999, short_name)
    return (int(m.group(1)), m.group(2))


output_routes = []

for r in routes_raw:
    route_id = r["route_id"]
    short_name = r["route_short_name"]
    long_name = r["route_long_name"]
    color = "#" + r["route_color"]

    trips = trips_by_route.get(route_id, [])
    if not trips:
        print(f"WARNING: no trips at all for route {short_name}")
        continue

    # Prefer direction_id "0"
    dir0 = [t for t in trips if t.get("direction_id") == "0"]
    direction_trips = dir0 or trips

    # Pick the trip with the most stop_times rows as the "fullest" representative pattern
    best_trip = None
    best_len = -1
    for t in direction_trips:
        st = stop_times_by_trip.get(t["trip_id"], [])
        if len(st) > best_len:
            best_len = len(st)
            best_trip = t

    if best_trip is None or best_len <= 1:
        print(f"WARNING: no usable stop_times for route {short_name}")
        continue

    st_rows = stop_times_by_trip[best_trip["trip_id"]]

    stops_out = []
    prev_arrival = None
    for i, row in enumerate(st_rows):
        stop_info = stops_by_id.get(row["stop_id"])
        if not stop_info:
            continue
        arrival = time_to_minutes(row["arrival_time"])
        travel_minutes = None if prev_arrival is None else round(arrival - prev_arrival)
        stops_out.append({
            "id": f"{short_name}-{i + 1}",
            "name": stop_info["stop_name"],
            "lat": float(stop_info["stop_lat"]),
            "lng": float(stop_info["stop_lon"]),
            "travelMinutes": travel_minutes,
        })
        prev_arrival = arrival

    # ── Shape polyline ──────────────────────────────────────────────────────
    shape_id = best_trip.get("shape_id")
    shape_out = []
    if shape_id and shape_id in shape_points:
        shape_out = [
            [float(p["shape_pt_lat"]), float(p["shape_pt_lon"])]
            for p in shape_points[shape_id]
        ]

    # ── Frequency / first-last departure across all trips in this direction ─
    origin_departures = []
    for t in direction_trips:
        st = stop_times_by_trip.get(t["trip_id"])
        if st:
            origin_departures.append(time_to_minutes(st[0]["arrival_time"]))
    origin_departures.sort()

    if len(origin_departures) >= 2:
        gaps = [b - a for a, b in zip(origin_departures, origin_departures[1:]) if b - a > 0]
        gaps.sort()
        if gaps:
            median_gap = statistics.median(gaps)
            lo = gaps[max(0, int(len(gaps) * 0.25))]
            hi = gaps[min(len(gaps) - 1, int(len(gaps) * 0.75))]
            lo, hi = round(lo), round(hi)
            if lo == hi:
                hi = lo + 5
            frequency_minutes = round(median_gap)
        else:
            frequency_minutes = 15
            lo, hi = 12, 18
        first_departure = minutes_to_hhmm(origin_departures[0])
        last_departure = minutes_to_hhmm(origin_departures[-1])
    else:
        frequency_minutes = 15
        lo, hi = 12, 18
        first_departure = minutes_to_hhmm(origin_departures[0]) if origin_departures else "06:00"
        last_departure = first_departure

    first_stop_name = stops_out[0]["name"] if stops_out else "?"
    last_stop_name = stops_out[-1]["name"] if stops_out else "?"

    output_routes.append({
        "id": short_name,
        "number": short_name,
        "name": long_name,
        "color": color,
        "description": f"Serves {len(stops_out)} stops between {first_stop_name} and {last_stop_name}.",
        "frequency": f"{lo}\u2013{hi} min",
        "frequencyMinutes": frequency_minutes,
        "operatingHours": f"{first_departure} \u2013 {last_departure}",
        "firstDeparture": first_departure,
        "lastDeparture": last_departure,
        "stops": stops_out,
        "shape": shape_out,
    })

output_routes.sort(key=lambda r: natural_sort_key(r["id"]))

with open("gtfs-raw/bus-routes.json", "w", encoding="utf-8") as f:
    json.dump(output_routes, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(output_routes)} routes to gtfs-raw/bus-routes.json")
for r in output_routes:
    print(f"  {r['id']:5s} {r['name']:45s} stops={len(r['stops']):3d} shapePts={len(r['shape']):5d} freq={r['frequency']}")
