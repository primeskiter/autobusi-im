import { cn } from "@/lib/utils.ts";
import { ArrowRight, Clock, Route, Timer, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { useCountdownTick } from "@/hooks/use-countdown-tick.ts";
import {
  BUS_ROUTES,
  getUpcomingDepartureCountdowns,
  type BusRoute,
  type BusStop,
  type DepartureCountdown,
} from "@/data/tirana-bus-data.ts";

type Props = {
  stop: BusStop;
  activeRoute: BusRoute | null;
  onClose: () => void;
  onSelectRoute: (route: BusRoute, originStop?: BusStop | null) => void;
};

type RouteAtStop = {
  route: BusRoute;
  stopIndex: number;
  countdowns: DepartureCountdown[];
};

function buildRoutesAtStop(stop: BusStop): RouteAtStop[] {
  const result: RouteAtStop[] = [];
  for (const route of BUS_ROUTES) {
    const idx = route.stops.findIndex((s) => s.name === stop.name);
    if (idx !== -1) {
      result.push({
        route,
        stopIndex: idx,
        countdowns: getUpcomingDepartureCountdowns(route, idx, 4),
      });
      continue;
    }
    // Not on the forward direction — check the return direction too, so a
    // stop served only on the way back still shows up here.
    const retIdx = route.stopsReturn.findIndex((s) => s.name === stop.name);
    if (retIdx !== -1) {
      result.push({
        route,
        stopIndex: retIdx,
        countdowns: getUpcomingDepartureCountdowns(route, retIdx, 4, route.stopsReturn),
      });
    }
  }
  return result;
}

export default function StopDetailPanel({ stop, activeRoute, onClose, onSelectRoute }: Props) {
  const { t } = useTranslation("common");
  // Re-render every 30s to keep countdowns fresh
  useCountdownTick(30000);
  const routesAtStop = buildRoutesAtStop(stop);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 bg-primary text-primary-foreground flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-primary-foreground/20 rounded-md px-2 py-0.5 text-xs font-semibold">
                {t("stop.badge")}
              </span>
            </div>
            <h2 className="text-base font-bold leading-tight">{stop.name}</h2>
            <p className="text-primary-foreground/70 text-xs mt-1">
              {t("stop.routes_pass", { count: routesAtStop.length })}
            </p>
            {import.meta.env.DEV && (
              <p className="text-primary-foreground/50 text-[10px] mt-1 font-mono select-all">
                ID: {stop.gtfsStopId} &middot; {stop.lat.toFixed(6)}, {stop.lng.toFixed(6)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 p-1 rounded-full hover:bg-primary-foreground/20 transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {routesAtStop.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            {t("stop.no_departures")}
          </div>
        ) : (
          <div className="py-2">
            <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("stop.upcoming")}
            </p>

            {routesAtStop.map(({ route, countdowns }) => {
              const isActive = activeRoute?.id === route.id;
              return (
                <div
                  key={route.id}
                  className={cn(
                    "mx-3 mb-2 rounded-xl border overflow-hidden transition-all",
                    isActive ? "border-2" : "border-border"
                  )}
                  style={isActive ? { borderColor: route.color } : {}}
                >
                  <button
                    onClick={() => onSelectRoute(route, stop)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <span
                      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm"
                      style={{ backgroundColor: route.color }}
                    >
                      {route.number}
                    </span>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold truncate">{route.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Timer className="w-3 h-3" />
                          {route.frequency}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {route.operatingHours}
                        </span>
                      </div>
                    </div>
                    <Route className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>

                  <div className="px-3 pb-3 pt-0">
                    {countdowns.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {countdowns.map((dep, i) => {
                          const isImminent = dep.minutesAway <= 5;
                          return (
                            <div key={i} className="flex items-center gap-1">
                              <Badge
                                className={cn(
                                  "text-xs px-2 py-0.5 font-mono font-semibold gap-1",
                                  i === 0 && isImminent
                                    ? "bg-emerald-500 text-white hover:bg-emerald-500 animate-pulse"
                                    : i === 0
                                      ? "text-white hover:opacity-90"
                                      : "bg-muted text-foreground hover:bg-muted"
                                )}
                                style={i === 0 && !isImminent ? { backgroundColor: route.color } : {}}
                              >
                                <span className="font-bold">
                                  {dep.minutesAway === 0
                                    ? t("countdown.now")
                                    : t("countdown.min", { min: dep.minutesAway })}
                                </span>
                                <span className="opacity-60 text-[10px]">{dep.time}</span>
                              </Badge>
                              {i < countdowns.length - 1 && (
                                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/40" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {t("stop.no_departures_today")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
