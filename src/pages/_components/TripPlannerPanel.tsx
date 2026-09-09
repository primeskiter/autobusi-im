import { ArrowDown, ArrowLeftRight, ChevronLeft, ChevronRight, Clock, MapPin, Navigation, Search, Timer, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { cn } from "@/lib/utils.ts";
import {
  fuzzyMatchStops,
  planTrip,
  type BusRoute,
  type TripOption,
} from "@/data/tirana-bus-data.ts";

type Props = {
  onSelectRoute: (route: BusRoute) => void;
  onClose: () => void;
};

// ── Stop autocomplete input ────────────────────────────────────────────────────
function StopInput({
  label,
  value,
  onChange,
  icon,
  color,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  color: string;
}) {
  const { t } = useTranslation("common");
  const [focused, setFocused] = useState(false);
  const suggestions = fuzzyMatchStops(value, 6);
  const showSuggestions = focused && value.trim().length > 0 && suggestions.length > 0;

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all",
          focused ? "border-ring ring-2 ring-ring/20" : "border-border"
        )}
      >
        <span style={{ color }}>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-1">
            {label}
          </p>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={t("planner.input_placeholder")}
            className="w-full text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60"
          />
        </div>
        {value && (
          <button
            onMouseDown={(e) => { e.preventDefault(); onChange(""); }}
            className="text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border border-border rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((name, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); onChange(name); setFocused(false); }}
              className={cn(
                "w-full text-left flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors",
                i > 0 && "border-t border-border/30"
              )}
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Horizontal stop-by-stop journey timeline ──────────────────────────────────
function JourneySlider({ option }: { option: TripOption }) {
  type Node =
    | { kind: "stop"; name: string; color: string; isBoard: boolean; isAlight: boolean }
    | { kind: "transfer"; label: string };

  const nodes: Node[] = [];

  option.legs.forEach((leg, legIdx) => {
    if (legIdx > 0) {
      nodes.push({ kind: "transfer", label: option.transferStops[legIdx - 1] ?? "" });
    }
    leg.route.stops
      .slice(leg.boardStopIndex, leg.alightStopIndex + 1)
      .forEach((stop, i, arr) => {
        nodes.push({
          kind: "stop",
          name: stop.name,
          color: leg.route.color,
          isBoard: i === 0 && legIdx === 0,
          isAlight: i === arr.length - 1 && legIdx === option.legs.length - 1,
        });
      });
  });

  return (
    <div className="overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex items-start gap-0 min-w-max px-4 py-3">
        {nodes.map((node, idx) => {
          if (node.kind === "transfer") {
            return (
              <div key={idx} className="flex items-center mx-1">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center">
                    <ArrowDown className="w-3 h-3 text-amber-600" />
                  </div>
                  <p className="text-[9px] text-amber-600 font-semibold text-center max-w-[56px] leading-tight">
                    Transfer
                  </p>
                </div>
              </div>
            );
          }

          const isFirst = idx === 0;
          const isLast = idx === nodes.length - 1;
          const connectorColor = node.color;

          return (
            <div key={idx} className="flex items-center">
              {!isFirst && nodes[idx - 1]?.kind === "stop" && (
                <div className="w-6 h-px mt-[-16px]" style={{ backgroundColor: connectorColor }} />
              )}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex-shrink-0 rounded-full border-2 flex items-center justify-center",
                    node.isBoard || node.isAlight ? "w-5 h-5" : "w-3 h-3"
                  )}
                  style={{
                    borderColor: node.color,
                    backgroundColor: node.isBoard || node.isAlight ? node.color : "white",
                  }}
                />
                <p
                  className={cn(
                    "text-[9px] text-center leading-tight max-w-[52px]",
                    node.isBoard || node.isAlight ? "font-bold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {node.name}
                </p>
              </div>
              {!isLast && nodes[idx + 1]?.kind === "stop" && (
                <div className="w-6 h-px mt-[-16px]" style={{ backgroundColor: connectorColor }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Single trip option — full detail card ─────────────────────────────────────
function TripOptionCard({
  option,
  index,
  onSelectRoute,
}: {
  option: TripOption;
  index: number;
  onSelectRoute: (route: BusRoute) => void;
}) {
  const { t } = useTranslation("common");
  const badgeColors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500"];
  const badgeLabels = [t("results.label_fastest"), t("results.label_alternative"), t("results.label_option3")];

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      {/* Card header */}
      <div className="px-4 py-3 bg-muted/40 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className={cn("text-white text-xs font-bold px-2.5 py-1 rounded-full", badgeColors[index])}>
            {badgeLabels[index]}
          </span>
          <span className="text-sm text-muted-foreground">
            {option.transfers === 0 ? t("results.direct") : t("results.transfer", { count: option.transfers })}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-base font-bold">
          <Timer className="w-4 h-4 text-muted-foreground" />
          <span>~{option.totalMinutes} min</span>
        </div>
      </div>

      {/* Journey timeline */}
      <div className="border-b border-border/60 bg-muted/10">
        <p className="px-4 pt-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t("results.journey_map")}
        </p>
        <JourneySlider option={option} />
      </div>

      {/* Legs detail */}
      <div className="p-4 space-y-4">
        {option.legs.map((leg, legIdx) => (
          <div key={legIdx}>
            {legIdx > 0 && (
              <div className="flex items-center gap-2 mb-3 px-1 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <ArrowDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {t("results.transfer_at")} <span className="font-semibold">{option.transferStops[legIdx - 1]}</span>
                </span>
              </div>
            )}

            <button
              onClick={() => onSelectRoute(leg.route)}
              className="w-full rounded-xl border border-border/60 overflow-hidden hover:border-border hover:shadow-md transition-all cursor-pointer"
            >
              {/* Route header */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ backgroundColor: `${leg.route.color}18` }}
              >
                <span
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm"
                  style={{ backgroundColor: leg.route.color }}
                >
                  {leg.route.number}
                </span>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold truncate">{leg.route.name}</p>
                  <p className="text-xs text-muted-foreground">{leg.travelMinutes} {t("results.on_bus")} · {leg.alightStopIndex - leg.boardStopIndex} {t("results.stops")}</p>
                </div>
                <span className="text-xs font-semibold text-primary flex-shrink-0">{t("results.view_map")}</span>
              </div>

              {/* Board / Alight */}
              <div className="px-4 py-3 bg-background">
                <div className="flex items-stretch gap-3">
                  <div className="flex flex-col items-center flex-shrink-0 pt-1">
                    <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: leg.route.color, backgroundColor: leg.route.color }} />
                    <div className="w-0.5 flex-1 my-1.5" style={{ backgroundColor: `${leg.route.color}50` }} />
                    <div className="w-3 h-3 rounded-full border-2 bg-background" style={{ borderColor: leg.route.color }} />
                  </div>
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t("results.board")}</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{leg.boardStop.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t("results.alight")}</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{leg.alightStop.name}</p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between items-end flex-shrink-0 gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t("results.freq")}</p>
                      <p className="text-xs font-mono font-semibold">{leg.route.frequency}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t("results.hours")}</p>
                      <p className="text-xs font-mono font-semibold">{leg.route.operatingHours}</p>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Full-screen results overlay (portal) ──────────────────────────────────────
function ResultsOverlay({
  results,
  origin,
  destination,
  onSelectRoute,
  onClose,
}: {
  results: TripOption[];
  origin: string;
  destination: string;
  onSelectRoute: (route: BusRoute) => void;
  onClose: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const dragStartIdx = useRef(0);
  const { t } = useTranslation("common");

  const badgeColors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500"];
  const badgeLabels = [t("results.label_fastest"), t("results.label_alternative"), t("results.label_option3")];

  const goTo = useCallback((idx: number) => {
    setActiveIdx(Math.max(0, Math.min(results.length - 1, idx)));
  }, [results.length]);

  const content = (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background/80 backdrop-blur-sm">
      <div
        className="relative flex flex-col bg-background shadow-2xl border-t border-border md:m-auto md:rounded-2xl md:border md:max-w-lg md:h-[85vh] w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-4 bg-primary text-primary-foreground md:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Navigation className="w-4 h-4 flex-shrink-0" />
                <h2 className="text-base font-bold">{t("results.title")}</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-primary-foreground/70 min-w-0">
                <span className="truncate font-medium">{origin}</span>
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
                <span className="truncate font-medium">{destination}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {results.length > 1 && (
            <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-hide pb-0.5">
              {results.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-95",
                    activeIdx === i
                      ? "bg-primary-foreground text-primary"
                      : "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", badgeColors[i])} />
                  {badgeLabels[i]}
                  <span className="opacity-80">· ~{opt.totalMinutes}m</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prev / Next nav bar */}
        {results.length > 1 && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
            <button
              onClick={() => goTo(activeIdx - 1)}
              disabled={activeIdx === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent transition-colors active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("results.prev")}
            </button>

            <div className="flex items-center gap-1.5">
              {results.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={cn(
                    "rounded-full transition-all cursor-pointer",
                    i === activeIdx ? "w-5 h-2 bg-primary" : "w-2 h-2 bg-border hover:bg-muted-foreground"
                  )}
                />
              ))}
            </div>

            <button
              onClick={() => goTo(activeIdx + 1)}
              disabled={activeIdx === results.length - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent transition-colors active:scale-95"
            >
              {t("results.next")}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable card area with swipe */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          onPointerDown={(e) => { dragStartX.current = e.clientX; dragStartIdx.current = activeIdx; }}
          onPointerUp={(e) => {
            if (dragStartX.current === null) return;
            const delta = e.clientX - dragStartX.current;
            if (delta < -50) goTo(dragStartIdx.current + 1);
            else if (delta > 50) goTo(dragStartIdx.current - 1);
            dragStartX.current = null;
          }}
        >
          {/* Only render the active slide — avoids any height collapse issue */}
          {results.map((option, i) => (
            <div
              key={i}
              className={cn(
                "h-full overflow-y-auto transition-all duration-300",
                i === activeIdx ? "block" : "hidden"
              )}
            >
              <div className="p-4">
                <TripOptionCard option={option} index={i} onSelectRoute={(r) => { onSelectRoute(r); onClose(); }} />
              </div>
              <div className="px-4 pb-6">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{t("results.disclaimer")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function TripPlannerPanel({ onSelectRoute, onClose }: Props) {
  const { t } = useTranslation("common");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [results, setResults] = useState<TripOption[] | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
    setResults(null);
    setError(null);
  }, [origin, destination]);

  const handlePlan = useCallback(() => {
    setError(null);
    setResults(null);
    const o = origin.trim();
    const d = destination.trim();
    if (!o || !d) { setError(t("planner.error_both")); return; }
    if (o.toLowerCase() === d.toLowerCase()) { setError(t("planner.error_same")); return; }
    const trips = planTrip(o, d);
    if (trips.length === 0) {
      setError(t("planner.error_no_route"));
    } else {
      setResults(trips);
      setShowOverlay(true);
    }
  }, [origin, destination, t]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handlePlan();
  }, [handlePlan]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 bg-primary text-primary-foreground flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4" />
            <h2 className="text-base font-bold">{t("planner.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-primary-foreground/20 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-primary-foreground/70 text-xs">
          {t("planner.description")}
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4 space-y-2">
          <div className="relative">
            <StopInput
              label={t("planner.from")}
              value={origin}
              onChange={(v) => { setOrigin(v); setResults(null); setError(null); }}
              icon={<div className="w-3 h-3 rounded-full bg-emerald-500" />}
              color="#10b981"
            />
          </div>

          <div className="flex justify-center relative z-10">
            <button
              onClick={handleSwap}
              className="bg-background border border-border rounded-full p-1.5 shadow-sm hover:bg-accent cursor-pointer transition-colors -my-1"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          <StopInput
            label={t("planner.to")}
            value={destination}
            onChange={(v) => { setDestination(v); setResults(null); setError(null); }}
            icon={<div className="w-3 h-3 rounded-full bg-red-500" />}
            color="#ef4444"
          />

          <Button
            className="w-full mt-1"
            onClick={handlePlan}
            onKeyDown={handleKeyDown}
            disabled={!origin.trim() || !destination.trim()}
          >
            <Search className="w-4 h-4 mr-2" />
            {t("planner.find_route")}
          </Button>
        </div>

        {error && (
          <div className="mx-4 mb-4 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {error}
          </div>
        )}

        {results && !showOverlay && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowOverlay(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity"
            >
              <Navigation className="w-4 h-4" />
              {t("planner.view_options", { count: results.length })}
            </button>
          </div>
        )}
      </ScrollArea>

      {/* Full-screen results overlay */}
      {results && showOverlay && (
        <ResultsOverlay
          results={results}
          origin={origin}
          destination={destination}
          onSelectRoute={onSelectRoute}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </div>
  );
}
