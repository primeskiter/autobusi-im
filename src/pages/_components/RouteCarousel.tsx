import { Clock, MapPin, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import type { BusRoute } from "@/data/tirana-bus-data.ts";
import BusIllustration from "./BusIllustration.tsx";

type Props = {
  routes: BusRoute[];
  selectedRoute: BusRoute | null;
  onSelectRoute: (route: BusRoute) => void;
};

export default function RouteCarousel({ routes, selectedRoute, onSelectRoute }: Props) {
  const { t } = useTranslation("common");

  if (routes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-3">
      {routes.map((route, idx) => {
        const isSelected = selectedRoute?.id === route.id;
        return (
          <motion.button
            key={route.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3), ease: "easeOut" as const }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectRoute(route)}
            className={cn(
              "relative overflow-hidden rounded-2xl border-2 text-left cursor-pointer transition-all h-20",
              "hover:shadow-md",
              isSelected ? "shadow-md" : "border-transparent"
            )}
            style={{ borderColor: isSelected ? route.color : "transparent" }}
          >
            {/* Background: the "picture of the bus", bleeding off the right edge */}
            <div className="absolute inset-0 bg-muted/40">
              <BusIllustration
                color={route.color}
                className="absolute h-[130%] w-auto top-1/2 -translate-y-1/2 -right-4 opacity-90"
              />
            </div>

            {/* Scrim: fades to the background color where the text sits, so it
                stays easy to read over the picture without hiding it entirely */}
            <div className="absolute inset-0 bg-gradient-to-r from-background from-[38%] via-background/95 via-[55%] to-transparent" />

            {/* Content */}
            <div className="relative z-10 flex items-center gap-2.5 h-full pl-3 pr-2">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                style={{ backgroundColor: route.color }}
              >
                {route.number}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">{route.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="text-[10px]">{t("route.stops_count", { count: route.stops.length })}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="text-[10px]">{route.frequency}</span>
                  </div>
                </div>
              </div>

              {isSelected && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-white leading-none flex-shrink-0"
                  style={{ backgroundColor: route.color }}
                >
                  {t("carousel.active")}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

