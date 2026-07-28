import { cn } from "@/lib/utils.ts";
import { Bus, Clock, MapPin } from "lucide-react";
import type { BusRoute } from "@/data/tirana-bus-data.ts";

type Props = {
  route: BusRoute;
  isSelected: boolean;
  onClick: () => void;
};

export default function RouteListItem({ route, isSelected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border/50 transition-all duration-150",
        "hover:bg-accent/60 cursor-pointer",
        isSelected && "bg-accent border-l-4 pl-3"
      )}
      style={isSelected ? { borderLeftColor: route.color } : {}}
    >
      <div className="flex items-center gap-3">
        {/* Route number badge */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm"
          style={{ backgroundColor: route.color }}
        >
          {route.number}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {route.name}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Bus className="w-3 h-3" />
              {route.frequency}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {route.stops.length} stops
            </span>
          </div>
        </div>

        {isSelected && (
          <div className="flex-shrink-0">
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </button>
  );
}
