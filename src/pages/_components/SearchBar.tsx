import { Search, X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { BUS_ROUTES, type BusRoute, type BusStop } from "@/data/tirana-bus-data.ts";

type SearchResult =
  | { type: "route"; route: BusRoute }
  | { type: "stop"; stop: BusStop; route: BusRoute };

type Props = {
  onSelectRoute: (route: BusRoute) => void;
  onSelectStop: (stop: BusStop, route: BusRoute) => void;
};

export default function SearchBar({ onSelectRoute, onSelectStop }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const results: SearchResult[] = [];

  if (query.trim().length > 0) {
    const q = query.toLowerCase();
    // Routes
    for (const route of BUS_ROUTES) {
      if (
        route.number.toLowerCase().includes(q) ||
        route.name.toLowerCase().includes(q) ||
        route.description.toLowerCase().includes(q)
      ) {
        results.push({ type: "route", route });
        if (results.length >= 8) break;
      }
    }
    // Stops
    if (results.length < 8) {
      for (const route of BUS_ROUTES) {
        for (const stop of route.stops) {
          if (stop.name.toLowerCase().includes(q)) {
            results.push({ type: "stop", stop, route });
            if (results.length >= 8) break;
          }
        }
        if (results.length >= 8) break;
      }
    }
  }

  const handleSelect = (result: SearchResult) => {
    if (result.type === "route") {
      onSelectRoute(result.route);
    } else {
      onSelectStop(result.stop, result.route);
    }
    setQuery("");
    setFocused(false);
  };

  return (
    <div className="relative z-[999]">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search routes or stops..."
          className="pl-9 pr-9 h-10 bg-background/95 backdrop-blur shadow-lg border-border/80"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {focused && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-xl overflow-hidden">
          {results.map((result, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(result)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer",
                "hover:bg-accent transition-colors",
                idx > 0 && "border-t border-border/40"
              )}
            >
              {result.type === "route" ? (
                <>
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: result.route.color }}
                  >
                    {result.route.number}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{result.route.name}</p>
                    <p className="text-xs text-muted-foreground">Bus Route</p>
                  </div>
                </>
              ) : (
                <>
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: result.route.color }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: result.route.color }}
                    />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{result.stop.name}</p>
                    <p className="text-xs text-muted-foreground">Line {result.route.number}</p>
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
