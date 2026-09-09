import csv
import io
import json
import math
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
    raw = _zip.open(name)
    text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
    return csv.DictReader(text)


def time_to_minutes(t):
    h, m, s = t.split(":")
    return int(h) * 60 + int(m) + int(s) / 60


def minutes_to_hhmm(total_minutes):
    total_minutes = round(total_minutes)
    h = (total_minutes // 60) % 24
    m = total_minutes % 60
    return f"{h:02d}:{m:02d}"


def natural_sort_key(short_name):
    import re
    m = re.match(r"(\d+)([A-Za-z]*)", short_name)
    if not m:
        return (999, short_name)
    return (int(m.group(1)), m.group(2))


# ── Planar projection helpers (Tirana is small enough that flat-earth is fine) ─
M_PER_DEG_LAT = 111_320.0


def m_per_deg_lon(lat):
    return 111_320.0 * math.cos(math.radians(lat))


def to_xy(lat, lon, ref_lat):
    return lon * m_per_deg_lon(ref_lat), lat * M_PER_DEG_LAT


def project_point_onto_polyline(lat, lon, poly_xy, cum_dist, ref_lat):
    px, py = to_xy(lat, lon, ref_lat)
    best_dist_along = 0.0
    best_perp = float("inf")
    for i in range(len(poly_xy) - 1):
        ax, ay = poly_xy[i]
        bx, by = poly_xy[i + 1]
        dx, dy = bx - ax, by - ay
        seg_len2 = dx * dx + dy * dy
        if seg_len2 == 0:
            t = 0.0
        else:
            t = ((px - ax) * dx + (py - ay) * dy) / seg_len2
            t = max(0.0, min(1.0, t))
        cx, cy = ax + t * dx, ay + t * dy
        perp = math.hypot(px - cx, py - cy)
        if perp < best_perp:
            best_perp = perp
            best_dist_along = cum_dist[i] + t * (cum_dist[i + 1] - cum_dist[i])
    return best_dist_along, best_perp


def build_polyline_xy_and_cumdist(shape_pts, ref_lat):
    xy = [to_xy(p_lat, p_lon, ref_lat) for (p_lat, p_lon) in shape_pts]
    cum = [0.0]
    for i in range(1, len(xy)):
        cum.append(cum[-1] + math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]))
    return xy, cum


# ── Load static tables ──────────────────────────────────────────────────────
routes_raw = read_csv("routes.txt")
stops_raw = read_csv("stops.txt")
trips_raw = read_csv("trips.txt")
calendar_raw = read_csv("calendar.txt")
shapes_raw = read_csv("shapes.txt")

stops_by_id = {s["stop_id"]: s for s in stops_raw}

# ── Manual overrides ─────────────────────────────────────────────────────────
# Lets you correct individual stops without losing the fix next time the
# official GTFS feed is re-imported. See gtfs-raw/overrides.json for the format.
try:
    with open("gtfs-raw/overrides.json", encoding="utf-8") as f:
        overrides = json.load(f)
except FileNotFoundError:
    overrides = {}

move_stops = overrides.get("moveStops", {})       # { gtfs_stop_id: {lat, lng} }
rename_stops = overrides.get("renameStops", {})   # { gtfs_stop_id: "New Name" }
hide_stops = set(overrides.get("hideStops", []))  # [ gtfs_stop_id, ... ]
add_stops = overrides.get("addStops", [])         # [ {routeId, direction, name, lat, lng, afterGtfsStopId?} ]

for sid, pos in move_stops.items():
    if sid in stops_by_id:
        stops_by_id[sid]["stop_lat"] = str(pos["lat"])
        stops_by_id[sid]["stop_lon"] = str(pos["lng"])
    else:
        print(f"WARNING: overrides.json moveStops references unknown stop_id {sid}")

for sid, new_name in rename_stops.items():
    if sid in stops_by_id:
        stops_by_id[sid]["stop_name"] = new_name
    else:
        print(f"WARNING: overrides.json renameStops references unknown stop_id {sid}")

# Manually-added stops get a synthetic stop_id and are injected per-route/direction below
extra_stop_ids_by_route_dir = defaultdict(set)  # (route_id, "fwd"|"return") -> {synthetic stop_id}
for i, add in enumerate(add_stops):
    synthetic_id = f"manual-{i}"
    stops_by_id[synthetic_id] = {
        "stop_id": synthetic_id,
        "stop_name": add["name"],
        "stop_lat": str(add["lat"]),
        "stop_lon": str(add["lng"]),
    }
    extra_stop_ids_by_route_dir[(add["routeId"], add.get("direction", "fwd"))].add(synthetic_id)
    # Note: routeId here refers to the route's visible short name (e.g. "1A"),
    # matched against route_short_name below — not GTFS's internal route_id.

# ── Pick the best weekday service PER ROUTE ─────────────────────────────────
# Different routes are authored with different (non-overlapping) sets of
# service_ids — there's no single service_id that covers every route, so a
# global choice left many routes with zero matching trips, silently falling
# back to "every trip across every season merged into one day", which
# produced nonsensical near-zero frequencies. Instead, pick per route: among
# the service_ids that route actually has trips under, prefer a normal
# Mon-Fri weekday service whose date range contains today, and among those,
# the most specific (narrowest) one.
route_service_ids = defaultdict(set)
for t in trips_raw:
    route_service_ids[t["route_id"]].add(t["service_id"])

calendar_by_id = {c["service_id"]: c for c in calendar_raw}

weekday_candidates = [
    c for c in calendar_raw
    if c["monday"] == "1" and int(c["start_date"]) <= TODAY <= int(c["end_date"])
]
normal_candidates = [
    c for c in weekday_candidates
    if c["tuesday"] == "1" and c["saturday"] == "0" and c["sunday"] == "0"
]
candidate_pool = sorted(
    normal_candidates or weekday_candidates,
    key=lambda c: int(c["end_date"]) - int(c["start_date"]),
)


def pick_service_for_route(route_id: str) -> str | None:
    used = route_service_ids.get(route_id, set())
    for c in candidate_pool:
        if c["service_id"] in used:
            return c["service_id"]
    # This route has no service covering today at all — fall back to any
    # Mon-Fri weekday service it does have, preferring the narrowest.
    own_weekday = [
        calendar_by_id[sid] for sid in used
        if sid in calendar_by_id and calendar_by_id[sid]["monday"] == "1"
    ]
    if own_weekday:
        return min(own_weekday, key=lambda c: int(c["end_date"]) - int(c["start_date"]))["service_id"]
    return None


route_chosen_service: dict[str, str | None] = {}

# ── Group trips by route, using each route's own best-matching service ──────
trips_by_route = defaultdict(list)
for r in routes_raw:
    rid = r["route_id"]
    svc = pick_service_for_route(rid)
    route_chosen_service[rid] = svc
    if svc:
        trips_by_route[rid] = [t for t in trips_raw if t["route_id"] == rid and t["service_id"] == svc]

all_trips_by_route = defaultdict(list)
for t in trips_raw:
    all_trips_by_route[t["route_id"]].append(t)
for rid, ts in all_trips_by_route.items():
    if not trips_by_route[rid]:
        trips_by_route[rid] = ts

for r in routes_raw:
    svc = route_chosen_service.get(r["route_id"])
    print(f"  service for {r['route_short_name']}: {svc or '(fallback: all trips merged)'}")

relevant_trip_ids = {t["trip_id"] for ts in trips_by_route.values() for t in ts}

# ── Single pass over stop_times.txt, keep only relevant trips ───────────────
stop_times_by_trip = defaultdict(list)
for row in open_csv_reader("stop_times.txt"):
    if row["trip_id"] in relevant_trip_ids:
        stop_times_by_trip[row["trip_id"]].append(row)

for trip_id in stop_times_by_trip:
    stop_times_by_trip[trip_id].sort(key=lambda r: int(r["stop_sequence"]))

# ── Group shape points ───────────────────────────────────────────────────────
shape_points_raw = defaultdict(list)
for r in shapes_raw:
    shape_points_raw[r["shape_id"]].append(r)
for sid in shape_points_raw:
    shape_points_raw[sid].sort(key=lambda r: int(r["shape_pt_sequence"]))
shape_latlon = {
    sid: [(float(p["shape_pt_lat"]), float(p["shape_pt_lon"])) for p in pts]
    for sid, pts in shape_points_raw.items()
}


def build_direction(direction_trips, short_name, suffix, hidden_ids, extra_ids):
    """Build a merged, correctly-ordered, complete stop list + shape for one
    direction of a route, by unioning every stop visited by any trip variant
    (plus any manually-added stops) and ordering them by projected distance
    along the fullest trip's shape. Manually-hidden stops are excluded."""
    if not direction_trips and not extra_ids:
        return None

    backbone = None
    if direction_trips:
        backbone = max(direction_trips, key=lambda t: len(stop_times_by_trip.get(t["trip_id"], [])))
    backbone_rows = stop_times_by_trip.get(backbone["trip_id"], []) if backbone else []
    if backbone is not None and len(backbone_rows) <= 1:
        backbone = None
        backbone_rows = []

    shape_id = backbone.get("shape_id") if backbone else None
    shape_pts = shape_latlon.get(shape_id, []) if shape_id else []
    if len(shape_pts) < 2:
        # Fall back to plotting a line through whatever stops we do have
        source_ids = [row["stop_id"] for row in backbone_rows] or list(extra_ids)
        shape_pts = [
            (float(stops_by_id[sid]["stop_lat"]), float(stops_by_id[sid]["stop_lon"]))
            for sid in source_ids if sid in stops_by_id
        ]
    if len(shape_pts) < 2:
        return None

    ref_lat = shape_pts[0][0]
    poly_xy, cum_dist = build_polyline_xy_and_cumdist(shape_pts, ref_lat)

    backbone_time_by_stop = {}
    for row in backbone_rows:
        backbone_time_by_stop.setdefault(row["stop_id"], time_to_minutes(row["arrival_time"]))

    union_stop_ids = set(extra_ids)
    for t in direction_trips:
        for row in stop_times_by_trip.get(t["trip_id"], []):
            union_stop_ids.add(row["stop_id"])
    union_stop_ids -= hidden_ids

    projected = []
    for sid in union_stop_ids:
        info = stops_by_id.get(sid)
        if not info:
            continue
        lat, lon = float(info["stop_lat"]), float(info["stop_lon"])
        dist_along, _perp = project_point_onto_polyline(lat, lon, poly_xy, cum_dist, ref_lat)
        projected.append((dist_along, sid, info))

    projected.sort(key=lambda x: x[0])

    n = len(projected)
    times = [backbone_time_by_stop.get(sid) for (_, sid, _) in projected]
    known_idx = [i for i, tm in enumerate(times) if tm is not None]
    if known_idx:
        for i in range(n):
            if times[i] is not None:
                continue
            before = max([k for k in known_idx if k < i], default=None)
            after = min([k for k in known_idx if k > i], default=None)
            if before is not None and after is not None:
                d0, d1 = projected[before][0], projected[after][0]
                t0, t1 = times[before], times[after]
                di = projected[i][0]
                frac = 0.5 if d1 == d0 else (di - d0) / (d1 - d0)
                times[i] = t0 + frac * (t1 - t0)
            elif before is not None:
                times[i] = times[before]
            elif after is not None:
                times[i] = times[after]
    else:
        times = [0.0] * n

    stops_out = []
    prev_t = None
    for i, (dist_along, sid, info) in enumerate(projected):
        t = times[i]
        travel_minutes = None if prev_t is None else max(0, round(t - prev_t))
        stops_out.append({
            "id": f"{short_name}-{suffix}{i + 1}",
            "gtfsStopId": sid,
            "name": info["stop_name"],
            "lat": float(info["stop_lat"]),
            "lng": float(info["stop_lon"]),
            "travelMinutes": travel_minutes,
        })
        prev_t = t

    shape_out = [[lat, lon] for (lat, lon) in shape_pts]

    origin_departures = sorted(
        time_to_minutes(stop_times_by_trip[t["trip_id"]][0]["arrival_time"])
        for t in direction_trips
        if stop_times_by_trip.get(t["trip_id"])
    )
    return {
        "stops": stops_out,
        "shape": shape_out,
        "origin_departures": origin_departures,
    }


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

    dir0_trips = [t for t in trips if t.get("direction_id") == "0"]
    dir1_trips = [t for t in trips if t.get("direction_id") == "1"]
    if not dir0_trips and not dir1_trips:
        dir0_trips = trips

    fwd = build_direction(
        dir0_trips, short_name, "", hide_stops,
        extra_stop_ids_by_route_dir.get((short_name, "fwd"), set()),
    )
    ret = build_direction(
        dir1_trips, short_name, "R", hide_stops,
        extra_stop_ids_by_route_dir.get((short_name, "return"), set()),
    )

    if fwd is None and ret is None:
        print(f"WARNING: no usable stop_times for route {short_name}")
        continue
    if fwd is None:
        fwd, ret = ret, None

    # Frequency is based on the forward direction's own departures only —
    # mixing in the return direction's departures was measuring the gap
    # between two unrelated buses (one leaving each end of the route),
    # which produced nonsensical near-zero frequencies.
    fwd_departures = sorted(fwd["origin_departures"])
    if len(fwd_departures) >= 2:
        span = fwd_departures[-1] - fwd_departures[0]
        avg_headway = span / (len(fwd_departures) - 1)
        frequency_minutes = max(1, round(avg_headway))
        # Display range as a band around the average rather than raw gap
        # percentiles — a handful of duplicate/near-simultaneous trips in the
        # source data (express + local leaving together, etc.) can otherwise
        # skew a percentile-based range down to something misleadingly tiny.
        lo = max(1, round(avg_headway * 0.7))
        hi = max(lo + 1, round(avg_headway * 1.3))
        first_departure = minutes_to_hhmm(fwd_departures[0])
        last_departure = minutes_to_hhmm(fwd_departures[-1])
    else:
        frequency_minutes, lo, hi = 15, 12, 18
        first_departure = minutes_to_hhmm(fwd_departures[0]) if fwd_departures else "06:00"
        last_departure = first_departure

    stops_out = fwd["stops"]
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
        "shape": fwd["shape"],
        "stopsReturn": ret["stops"] if ret else [],
        "shapeReturn": ret["shape"] if ret else [],
    })

output_routes.sort(key=lambda r: natural_sort_key(r["id"]))

with open("gtfs-raw/bus-routes.json", "w", encoding="utf-8") as f:
    json.dump(output_routes, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(output_routes)} routes to gtfs-raw/bus-routes.json")
for r in output_routes:
    print(
        f"  {r['id']:5s} {r['name']:45s} "
        f"fwd_stops={len(r['stops']):3d} ret_stops={len(r['stopsReturn']):3d} "
        f"fwd_shape={len(r['shape']):5d} ret_shape={len(r['shapeReturn']):5d} freq={r['frequency']}"
    )
