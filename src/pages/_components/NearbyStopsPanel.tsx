import { cn } from "@/lib/utils.ts";
import { Clock, Footprints, Loader2, MapPin, MapPinOff, Navigation2, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useCountdownTick } from "@/hooks/use-countdown-tick.ts";
import {
  getNearbyStops,
  getUpcomingDepartureCountdowns,
  type BusRoute,
  type BusStop,
  type NearbyStop,
} from "@/data/tirana-bus-data.ts";
import type { GeolocationStatus } from "@/hooks/use-geolocation.ts";

type Props = {
  latitude: number | null;
  longitude: number | null;
  locationStatus: GeolocationStatus;
  onRequestLocation: () => void;
  onClose: () => void;
  onSelectStop: (stop: BusStop) => void;
  onSelectRoute: (route: BusRoute) => void;
};

export default function NearbyStopsPanel({
  latitude,
  longitude,
  locationStatus,
  onRequestLocation,
  onClose,
  onSelectStop,
  onSelectRoute,
}: Props) {
  const { t } = useTranslation("common");
  // Re-render every 30s to keep countdowns fresh
  useCountdownTick(30000);

  const nearbyStops = useMemo<NearbyStop[]>(() => {
    if (latitude === null || longitude === null) return [];
    return getNearbyStops(latitude, longitude);
  }, [latitude, longitude]);

  // Prompt for location access
  if (locationStatus === "idle") {
    return (
      <div className="flex flex-col h-full">
        <Header onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Navigation2 className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-semibold mb-1">{t("nearby.enable_location")}</p>
          <p className="text-xs text-muted-foreground mb-4">{t("nearby.enable_description")}</p>
          <Button size="sm" onClick={onRequestLocation}>
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            {t("nearby.allow_location")}
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (locationStatus === "loading") {
    return (
      <div className="flex flex-col h-full">
        <Header onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">{t("nearby.locating")}</p>
        </div>
      </div>
    );
  }

  // Denied state
  if (locationStatus === "denied") {
    return (
      <div className="flex flex-col h-full">
        <Header onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <MapPinOff className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-sm font-semibold mb-1">{t("nearby.location_denied")}</p>
          <p className="text-xs text-muted-foreground mb-4">{t("nearby.denied_description")}</p>
          <Button size="sm" variant="secondary" onClick={onRequestLocation}>
            {t("nearby.try_again")}
          </Button>
        </div>
      </div>
    );
  }

  // Unavailable / error
  if (locationStatus === "unavailable" || locationStatus === "error") {
    return (
      <div className="flex flex-col h-full">
        <Header onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <MapPinOff className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold mb-1">{t("nearby.location_unavailable")}</p>
          <p className="text-xs text-muted-foreground mb-4">{t("nearby.unavailable_description")}</p>
          <Button size="sm" variant="secondary" onClick={onRequestLocation}>
            {t("nearby.try_again")}
          </Button>
        </div>
      </div>
    );
  }

  // Success — show nearby stops
  return (
    <div className="flex flex-col h-full">
      <Header onClose={onClose} />
      <ScrollArea className="flex-1">
        {nearbyStops.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            {t("nearby.no_stops")}
          </div>
        ) : (
          <div className="py-2 space-y-1.5">
            {nearbyStops.map((item) => (
              <NearbyStopCard
                key={item.stop.id}
                item={item}
                onSelectStop={onSelectStop}
                onSelectRoute={onSelectRoute}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("common");
  return (
    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Navigation2 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold leading-tight">{t("nearby.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("nearby.subtitle")}</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-full hover:bg-accent transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function NearbyStopCard({
  item,
  onSelectStop,
  onSelectRoute,
}: {
  item: NearbyStop;
  onSelectStop: (stop: BusStop) => void;
  onSelectRoute: (route: BusRoute) => void;
}) {
  const { t } = useTranslation("common");
  const metersAway = Math.round(item.distanceKm * 1000);
  const walkMin = Math.max(1, item.walkingMinutes);

  // Get countdown for the soonest departure across all routes at this stop
  const firstRouteInfo = item.routes[0];
  const nextCountdown = firstRouteInfo
    ? getUpcomingDepartureCountdowns(firstRouteInfo.route, firstRouteInfo.stopIndex, 1)[0]
    : null;

  const isImminent = nextCountdown ? nextCountdown.minutesAway <= 5 : false;

  return (
    <div className="mx-3 rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => onSelectStop(item.stop)}
        className="w-full flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <MapPin className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold truncate">{item.stop.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Footprints className="w-3 h-3" />
              {t("nearby.walk_min", { min: walkMin })}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("nearby.meters", { m: metersAway })}
            </span>
          </div>
        </div>
        {nextCountdown && (
          <div className="flex-shrink-0 text-right">
            <div className={cn(
              "flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded-md",
              isImminent
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 animate-pulse"
                : "text-primary"
            )}>
              <Clock className="w-3 h-3" />
              {nextCountdown.minutesAway === 0
                ? t("countdown.now")
                : t("countdown.min", { min: nextCountdown.minutesAway })}
            </div>
          </div>
        )}
      </button>

      {/* Route chips */}
      <div className="px-3 pb-2.5 flex flex-wrap gap-1.5">
        {item.routes.map(({ route }) => (
          <button
            key={route.id}
            onClick={() => onSelectRoute(route)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer",
              "hover:opacity-80 transition-opacity text-white"
            )}
            style={{ backgroundColor: route.color }}
          >
            {route.number}
          </button>
        ))}
      </div>
    </div>
  );
}
