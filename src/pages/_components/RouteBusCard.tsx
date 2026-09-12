import type { ReactNode } from "react";
import { Clock, MapPin, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import type { BusRoute } from "@/data/tirana-bus-data.ts";
import BusIllustration from "./BusIllustration.tsx";

type Props = {
  route: BusRoute;
  onClick: () => void;
  isSelected?: boolean;
  /** Overrides the default "N stops · frequency" line, e.g. a live per-stop countdown. */
  subtitle?: ReactNode;
  /** Stagger delay index for the entrance animation. */
  index?: number;
  className?: string;
};

/**
 * A big, bold "picture of the bus" route card: the shared building block for
 * every place in the app where a route is shown as a pickable thing (main
 * route list, nearby stops, stop detail, favorites, search results). Keeping
 * this in one component means the illustration, sizing, and scrim only need
 * to be tuned once and every surface stays visually consistent.
 */
export default function RouteBusCard({ route, onClick, isSelected = false, subtitle, index = 0, className }: Props) {
  const { t } = useTranslation("common");

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.3), ease: "easeOut" as const }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 text-left cursor-pointer transition-all h-24 w-full",
        "hover:shadow-md",
        isSelected ? "shadow-md" : "border-transparent",
        className
      )}
      style={{ borderColor: isSelected ? route.color : "transparent" }}
    >
      {/* Background: the "picture of the bus", bleeding off the right edge */}
      <div className="absolute inset-0 bg-muted/40">
        <BusIllustration
          color={route.color}
          className="absolute h-[160%] w-auto top-1/2 -translate-y-1/2 right-0"
        />
      </div>

      {/* Scrim: fades to the background color where the text sits, so it
          stays easy to read over the picture without hiding it entirely.
          The illustration's own dark glass band gives it enough contrast
          to survive being faded, so this can stay light and narrow. */}
      <div className="absolute inset-0 bg-gradient-to-r from-background from-[26%] via-background/80 via-[42%] to-transparent" />

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
            {subtitle ?? (
              <>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="text-[10px]">{t("route.stops_count", { count: route.stops.length })}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="text-[10px]">{route.frequency}</span>
                </div>
              </>
            )}
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
}
