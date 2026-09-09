import { Home, Briefcase, GraduationCap, Star, Plus, Trash2, ChevronLeft, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import { BUS_ROUTES, getUpcomingDepartureCountdowns, type BusRoute, type BusStop } from "@/data/tirana-bus-data.ts";
import { useCountdownTick } from "@/hooks/use-countdown-tick.ts";
import { useFavorites, type FavoriteLabel } from "@/hooks/use-favorites.ts";

type Props = {
  onSelectStop: (stop: BusStop, route: BusRoute) => void;
  onClose: () => void;
};

const LABEL_ICONS: Record<FavoriteLabel, typeof Home> = {
  home: Home,
  work: Briefcase,
  school: GraduationCap,
  custom: Star,
};

const LABEL_COLORS: Record<FavoriteLabel, string> = {
  home: "text-blue-500",
  work: "text-amber-500",
  school: "text-green-500",
  custom: "text-purple-500",
};

const LABEL_BG: Record<FavoriteLabel, string> = {
  home: "bg-blue-500/10",
  work: "bg-amber-500/10",
  school: "bg-green-500/10",
  custom: "bg-purple-500/10",
};

export default function FavoritesPanel({ onSelectStop, onClose }: Props) {
  const { t } = useTranslation("common");
  // Re-render every 30s so the live countdowns in the list stay fresh
  useCountdownTick(30000);
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<FavoriteLabel>("home");
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [boardingStopName, setBoardingStopName] = useState<string>("");
  const [alightingStopName, setAlightingStopName] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [activeFilter, setActiveFilter] = useState<FavoriteLabel | null>(null);

  const selectedRouteForForm = BUS_ROUTES.find((r) => r.id === selectedRouteId) ?? null;

  const handleAdd = () => {
    if (!selectedRouteId || !boardingStopName) return;
    addFavorite(selectedRouteId, boardingStopName, selectedLabel, {
      alightingStopName: alightingStopName || undefined,
      customName: selectedLabel === "custom" ? customName : undefined,
    });
    setShowAddForm(false);
    setSelectedRouteId("");
    setBoardingStopName("");
    setAlightingStopName("");
    setCustomName("");
  };

  const filteredFavorites = activeFilter ? favorites.filter((f) => f.label === activeFilter) : favorites;

  const filteredGrouped = filteredFavorites.reduce<Record<FavoriteLabel, typeof favorites>>((acc, fav) => {
    if (!acc[fav.label]) acc[fav.label] = [];
    acc[fav.label]!.push(fav);
    return acc;
  }, {} as Record<FavoriteLabel, typeof favorites>);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1 -ml-1 hover:bg-accent rounded-lg transition-colors cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold leading-tight">{t("favorites.title")}</h2>
                <p className="text-[10px] text-muted-foreground">{t("favorites.subtitle")}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("favorites.add")}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-b border-border/60 overflow-hidden"
        >
          <div className="p-4 space-y-3">
            {/* Label selection */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t("favorites.label_prompt")}</p>
              <div className="flex gap-2">
                {(["home", "work", "school", "custom"] as FavoriteLabel[]).map((label) => {
                  const Icon = LABEL_ICONS[label];
                  return (
                    <button
                      key={label}
                      onClick={() => setSelectedLabel(label)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border",
                        selectedLabel === label
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/50 text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t(`favorites.label_${label}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom name */}
            {selectedLabel === "custom" && (
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={t("favorites.custom_placeholder")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            )}

            {/* Route selection */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t("favorites.select_route")}</p>
              <select
                value={selectedRouteId}
                onChange={(e) => {
                  setSelectedRouteId(e.target.value);
                  setBoardingStopName("");
                  setAlightingStopName("");
                }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">{t("favorites.choose_route")}</option>
                {BUS_ROUTES.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.number} — {route.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Boarding stop — the actual point of a favorite: which stop to check */}
            {selectedRouteForForm && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t("favorites.select_boarding")}</p>
                <select
                  value={boardingStopName}
                  onChange={(e) => setBoardingStopName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{t("favorites.choose_stop")}</option>
                  {selectedRouteForForm.stops.map((stop) => (
                    <option key={stop.id} value={stop.name}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Drop-off stop — optional */}
            {selectedRouteForForm && boardingStopName && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t("favorites.select_alighting")} <span className="opacity-60">({t("favorites.optional")})</span>
                </p>
                <select
                  value={alightingStopName}
                  onChange={(e) => setAlightingStopName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{t("favorites.none")}</option>
                  {selectedRouteForForm.stops
                    .filter((s) => s.name !== boardingStopName)
                    .map((stop) => (
                      <option key={stop.id} value={stop.name}>
                        {stop.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!selectedRouteId || !boardingStopName}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("favorites.save")}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedRouteId("");
                  setBoardingStopName("");
                  setAlightingStopName("");
                }}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                {t("favorites.cancel")}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Favorites list */}
      <div className="flex-1 overflow-y-auto">
        {/* Category filter slider */}
        <div className="px-4 pt-3 pb-2 border-b border-border/40 flex-shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setActiveFilter(null)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                activeFilter === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {t("filter.all")}
            </button>
            {(["home", "work", "school", "custom"] as FavoriteLabel[]).map((label) => {
              const Icon = LABEL_ICONS[label];
              const count = favorites.filter((f) => f.label === label).length;
              return (
                <button
                  key={label}
                  onClick={() => setActiveFilter(activeFilter === label ? null : label)}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                    activeFilter === label
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {t(`favorites.label_${label}`)}
                  {count > 0 && (
                    <span
                      className={cn(
                        "ml-0.5 text-[10px] font-bold",
                        activeFilter === label ? "text-primary-foreground/70" : "text-muted-foreground/70"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 space-y-4">
          {filteredFavorites.length === 0 && !showAddForm ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Star className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">{t("favorites.empty_title")}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{t("favorites.empty_description")}</p>
            </div>
          ) : (
            Object.entries(filteredGrouped).map(([label, items]) => {
              const Icon = LABEL_ICONS[label as FavoriteLabel];
              return (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn("w-3.5 h-3.5", LABEL_COLORS[label as FavoriteLabel])} />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t(`favorites.label_${label}`)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((fav) => {
                      const route = BUS_ROUTES.find((r) => r.id === fav.routeId);
                      if (!route) return null;
                      const stopIdx = route.stops.findIndex((s) => s.name === fav.boardingStopName);
                      const boardingStop = stopIdx !== -1 ? route.stops[stopIdx] : null;
                      const nextArrival =
                        stopIdx !== -1 ? getUpcomingDepartureCountdowns(route, stopIdx, 1)[0] : undefined;

                      return (
                        <motion.div
                          key={`${fav.routeId}-${fav.boardingStopName}-${fav.label}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-xl border border-border/60 transition-all",
                            "hover:border-border hover:shadow-sm cursor-pointer group",
                            LABEL_BG[label as FavoriteLabel]
                          )}
                          onClick={() => boardingStop && onSelectStop(boardingStop, route)}
                        >
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: route.color }}
                          >
                            {route.number}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {fav.customName || `${t("route.line")} ${route.number}`}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              {fav.boardingStopName}
                              {fav.alightingStopName && (
                                <>
                                  <ArrowRight className="w-2.5 h-2.5 flex-shrink-0" />
                                  {fav.alightingStopName}
                                </>
                              )}
                            </p>
                          </div>
                          {nextArrival ? (
                            <span
                              className={cn(
                                "flex-shrink-0 text-xs font-mono font-semibold px-2 py-1 rounded-md",
                                nextArrival.minutesAway <= 5
                                  ? "bg-emerald-500 text-white"
                                  : "bg-muted text-foreground"
                              )}
                            >
                              {nextArrival.minutesAway === 0
                                ? t("countdown.now")
                                : t("countdown.min", { min: nextArrival.minutesAway })}
                            </span>
                          ) : (
                            <span className="flex-shrink-0 text-[10px] text-muted-foreground/60">
                              {t("route.no_more_today")}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFavorite(fav.routeId, fav.boardingStopName, fav.label);
                            }}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all cursor-pointer flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
