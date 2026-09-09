import { cn } from "@/lib/utils.ts";
import { Bus, Clock, MapPin, Timer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { useCountdownTick } from "@/hooks/use-countdown-tick.ts";
import {
  getCumulativeTravelMinutes,
  getUpcomingDepartureCountdowns,
  type BusRoute,
  type BusStop,
} from "@/data/tirana-bus-data.ts";

type Props = {
  route: BusRoute;
  selectedStop: BusStop | null;
  onClose: () => void;
  onStopClick: (stop: BusStop) => void;
};

function RouteSlider({
  route,
  activeIndex,
  onChangeIndex,
  color,
}: {
  route: BusRoute;
  activeIndex: number;
  onChangeIndex: (idx: number) => void;
  color: string;
}) {
  const { t } = useTranslation("common");
  const trackRef = useRef<HTMLDivElement>(null);
  const cumulative = getCumulativeTravelMinutes(route.stops);
  const total = cumulative[route.stops.length - 1] ?? 1;
  const pct = total > 0 ? ((cumulative[activeIndex] ?? 0) / total) * 100 : 0;

  const getIndexFromX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return activeIndex;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      let best = 0;
      let bestDist = Infinity;
      route.stops.forEach((_, i) => {
        const stopRatio = total > 0 ? (cumulative[i] ?? 0) / total : i / (route.stops.length - 1);
        const d = Math.abs(stopRatio - ratio);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    },
    [activeIndex, cumulative, route.stops, total]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      onChangeIndex(getIndexFromX(e.clientX));
    },
    [getIndexFromX, onChangeIndex]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      onChangeIndex(getIndexFromX(e.clientX));
    },
    [getIndexFromX, onChangeIndex]
  );

  const activeStop = route.stops[activeIndex];

  return (
    <div className="px-4 pt-3 pb-4 border-b border-border/40 bg-background flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground truncate max-w-[55%]">
          {activeStop?.name}
        </span>
        <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
          {t("route.stop_label", { num: activeIndex + 1, total: route.stops.length, min: cumulative[activeIndex] ?? 0 })}
        </span>
      </div>

      <div
        ref={trackRef}
        className="relative h-5 flex items-center cursor-pointer select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" />
        <div
          className="absolute left-0 h-1.5 rounded-full transition-none"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        {route.stops.map((_, i) => {
          const tickPct = total > 0 ? ((cumulative[i] ?? 0) / total) * 100 : (i / Math.max(route.stops.length - 1, 1)) * 100;
          const isTerminal = i === 0 || i === route.stops.length - 1;
          const isActive = i === activeIndex;
          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 transition-transform"
              style={{ left: `${tickPct}%` }}
            >
              <div
                className={cn("rounded-full border-2 transition-all", isActive && "scale-125")}
                style={{
                  width: isTerminal ? "10px" : "7px",
                  height: isTerminal ? "10px" : "7px",
                  borderColor: color,
                  backgroundColor: i <= activeIndex ? color : "white",
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground truncate max-w-[45%]">
          {route.stops[0]?.name}
        </span>
        <span className="text-[10px] text-muted-foreground truncate max-w-[45%] text-right">
          {route.stops[route.stops.length - 1]?.name}
        </span>
      </div>
    </div>
  );
}

export default function RouteDetailPanel({ route, selectedStop, onClose, onStopClick }: Props) {
  const { t } = useTranslation("common");
  // Re-render every 30s to keep countdowns fresh
  useCountdownTick(30000);
  const cumulative = getCumulativeTravelMinutes(route.stops);
  const totalMinutes = cumulative[route.stops.length - 1] ?? 0;
  const [sliderIndex, setSliderIndex] = useState(0);
  const stopListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedStop) {
      const idx = route.stops.findIndex((s) => s.gtfsStopId === selectedStop.gtfsStopId);
      if (idx !== -1) setSliderIndex(idx);
    }
  }, [selectedStop, route.stops]);

  const handleSliderChange = useCallback(
    (idx: number) => {
      setSliderIndex(idx);
      const stop = route.stops[idx];
      if (stop) onStopClick(stop);
    },
    [route.stops, onStopClick]
  );

  useEffect(() => {
    const el = stopListRef.current?.querySelector(`[data-stop-index="${sliderIndex}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [sliderIndex]);

  const nextDepartures = getUpcomingDepartureCountdowns(route, 0, 3);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 text-white flex-shrink-0" style={{ backgroundColor: route.color }}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-white/20 rounded-md px-2 py-0.5 text-sm font-bold">
                {t("route.line")} {route.number}
              </span>
            </div>
            <h2 className="text-base font-bold leading-tight">{route.name}</h2>
            <p className="text-white/80 text-xs mt-1 leading-snug">{route.description}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          <span className="flex items-center gap-1.5 text-white/90 text-xs">
            <Timer className="w-3.5 h-3.5" />
            {route.frequency}
          </span>
          <span className="flex items-center gap-1.5 text-white/90 text-xs">
            <Bus className="w-3.5 h-3.5" />
            {route.operatingHours}
          </span>
          <span className="flex items-center gap-1.5 text-white/90 text-xs">
            <MapPin className="w-3.5 h-3.5" />
            {t("route.stops_count", { count: route.stops.length })}
          </span>
          <span className="flex items-center gap-1.5 text-white/90 text-xs">
            <Clock className="w-3.5 h-3.5" />
            {t("route.total_min", { min: totalMinutes })}
          </span>
        </div>

        {nextDepartures.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-white/70 text-xs mb-1.5">{t("route.next_departures")}</p>
            <div className="flex gap-2">
              {nextDepartures.map((dep, i) => {
                const isImminent = dep.minutesAway <= 5;
                return (
                  <span
                    key={i}
                    className={cn(
                      "text-xs font-mono font-semibold px-2 py-1 rounded-md flex items-center gap-1",
                      i === 0 && isImminent
                        ? "bg-emerald-400 text-emerald-900 animate-pulse"
                        : i === 0
                          ? "bg-white text-gray-800"
                          : "bg-white/20 text-white"
                    )}
                  >
                    <span className="font-bold">
                      {dep.minutesAway === 0
                        ? t("countdown.now")
                        : t("countdown.min", { min: dep.minutesAway })}
                    </span>
                    <span className={cn("text-[10px]", i === 0 ? "opacity-60" : "opacity-50")}>
                      {dep.time}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <RouteSlider
        route={route}
        activeIndex={sliderIndex}
        onChangeIndex={handleSliderChange}
        color={route.color}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="py-2" ref={stopListRef}>
          <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("route.stops_section")}
          </p>
          {route.stops.map((stop, idx) => {
            const isTerminal = idx === 0 || idx === route.stops.length - 1;
            const isActive = sliderIndex === idx;
            const nextHere = getUpcomingDepartureCountdowns(route, idx, 1)[0];

            return (
              <button
                key={stop.id}
                data-stop-index={idx}
                onClick={() => handleSliderChange(idx)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-2 text-left cursor-pointer",
                  "hover:bg-accent/60 transition-colors",
                  isActive && "bg-accent"
                )}
              >
                <div className="flex flex-col items-center flex-shrink-0 self-stretch pt-1">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 border-2"
                    style={{
                      borderColor: route.color,
                      backgroundColor: isTerminal ? route.color : "white",
                      width: isTerminal ? "14px" : "12px",
                      height: isTerminal ? "14px" : "12px",
                    }}
                  />
                  {idx < route.stops.length - 1 && (
                    <div className="w-0.5 flex-1 mt-1" style={{ backgroundColor: `${route.color}40` }} />
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm text-foreground leading-tight", isTerminal && "font-semibold")}>
                      {stop.name}
                    </p>
                    {nextHere ? (
                      <span
                        className={cn(
                          "text-xs font-mono font-semibold flex-shrink-0 tabular-nums mt-0.5 px-1.5 py-0.5 rounded",
                          nextHere.minutesAway <= 5
                            ? "bg-emerald-500 text-white"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {nextHere.minutesAway === 0
                          ? t("countdown.now")
                          : t("countdown.min", { min: nextHere.minutesAway })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 flex-shrink-0 mt-0.5">
                        {t("route.no_more_today")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {isTerminal && (
                      <Badge variant="secondary" className="text-xs h-4 px-1.5">
                        {idx === 0 ? t("route.origin") : t("route.terminus")}
                      </Badge>
                    )}
                    {idx > 0 && stop.travelMinutes && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Timer className="w-2.5 h-2.5" />
                        {t("route.from_prev", { min: stop.travelMinutes })}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
