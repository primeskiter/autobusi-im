import { MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import {
  findStopByName,
  fuzzyMatchRoutes,
  fuzzyMatchStops,
  type BusRoute,
  type BusStop,
} from "@/data/tirana-bus-data.ts";

type Props = {
  onSelectRoute: (route: BusRoute) => void;
  onSelectStop: (stop: BusStop) => void;
};

export default function GlobalSearchBar({ onSelectRoute, onSelectStop }: Props) {
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Desktop convenience: "/" or Cmd/Ctrl+K jumps focus to search, like most
  // fast web apps (Linear, Notion, etc.) — but not while typing elsewhere.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "/" && !isTyping) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && target === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const routeResults = fuzzyMatchRoutes(query, 4);
  const stopResults = fuzzyMatchStops(query, 6);
  const hasQuery = query.trim().length > 0;
  const hasResults = routeResults.length > 0 || stopResults.length > 0;
  const showDropdown = focused && hasQuery;

  const handlePickRoute = useCallback(
    (route: BusRoute) => {
      onSelectRoute(route);
      setQuery("");
      inputRef.current?.blur();
    },
    [onSelectRoute]
  );

  const handlePickStop = useCallback(
    (name: string) => {
      const stop = findStopByName(name);
      if (stop) onSelectStop(stop);
      setQuery("");
      inputRef.current?.blur();
    },
    [onSelectStop]
  );

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg transition-all",
          focused ? "border-ring ring-2 ring-ring/20" : "border-border"
        )}
      >
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={t("search.placeholder")}
          className="w-full text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="flex-shrink-0 p-0.5 rounded-full hover:bg-accent cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        {!focused && !query && (
          <kbd className="hidden md:flex flex-shrink-0 items-center px-1.5 py-0.5 rounded border border-border text-[10px] text-muted-foreground font-mono">
            /
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto py-1">
          {!hasResults && (
            <p className="px-3 py-3 text-sm text-muted-foreground text-center">{t("search.no_results")}</p>
          )}

          {routeResults.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("search.routes_label")}
              </p>
              {routeResults.map((route) => (
                <button
                  key={route.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickRoute(route)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/60 transition-colors cursor-pointer"
                >
                  <span
                    className="flex-shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: route.color }}
                  >
                    {route.number}
                  </span>
                  <span className="text-sm text-foreground truncate">{route.name}</span>
                </button>
              ))}
            </div>
          )}

          {stopResults.length > 0 && (
            <div>
              <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("search.stops_label")}
              </p>
              {stopResults.map((name) => (
                <button
                  key={name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickStop(name)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/60 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground truncate">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
