import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import type { BusRoute } from "@/data/tirana-bus-data.ts";

type Props = {
  routes: BusRoute[];
  selectedRoute: BusRoute | null;
  onSelectRoute: (route: BusRoute) => void;
};

export default function RouteCarousel({ routes, selectedRoute, onSelectRoute }: Props) {
  const { t } = useTranslation("common");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  const scrollBy = useCallback((dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  }, []);

  if (routes.length === 0) return null;

  return (
    <div className="relative flex-shrink-0">
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background border border-border shadow-md flex items-center justify-center cursor-pointer hover:bg-accent transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scrollBy(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background border border-border shadow-md flex items-center justify-center cursor-pointer hover:bg-accent transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 z-[5] pointer-events-none bg-gradient-to-r from-background to-transparent" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 z-[5] pointer-events-none bg-gradient-to-l from-background to-transparent" />
      )}

      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 py-3"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {routes.map((route, idx) => {
          const isSelected = selectedRoute?.id === route.id;
          return (
            <motion.button
              key={route.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.04, ease: "easeOut" as const }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelectRoute(route)}
              className={cn(
                "flex-shrink-0 w-36 rounded-xl border-2 p-2.5 text-left cursor-pointer transition-shadow",
                "hover:shadow-md",
                isSelected
                  ? "shadow-lg"
                  : "border-transparent bg-muted/60 hover:bg-muted"
              )}
              style={{
                borderColor: isSelected ? route.color : "transparent",
                backgroundColor: isSelected ? `${route.color}12` : undefined,
                scrollSnapAlign: "start",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: route.color }}
                >
                  {route.number}
                </span>
                {isSelected && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-white leading-none"
                    style={{ backgroundColor: route.color }}
                  >
                    {t("carousel.active")}
                  </span>
                )}
              </div>

              <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 mb-2">
                {route.name}
              </p>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="text-[10px]">{t("route.stops_count", { count: route.stops.length })}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="text-[10px]">{route.frequency}</span>
                </div>
              </div>

              <div
                className="mt-2 h-1 rounded-full w-full"
                style={{ backgroundColor: route.color, opacity: isSelected ? 1 : 0.4 }}
              />
            </motion.button>
          );
        })}
      </div>

      <div className="flex justify-center gap-1 pb-1">
        {Array.from({ length: Math.ceil(routes.length / 3) }).map((_, i) => (
          <div key={i} className="w-1 h-1 rounded-full bg-muted-foreground/30" />
        ))}
      </div>
    </div>
  );
}
