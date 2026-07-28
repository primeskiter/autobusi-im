"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bus, ChevronDown, ChevronUp, Info, Locate, Navigation, Star, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { useNavigate, useLocation } from "react-router-dom";

import {
  AREAS,
  BUS_ROUTES,
  TIRANA_CENTER,
  getRouteAreas,
  type BusRoute,
  type BusStop } from
"@/data/tirana-bus-data.ts";
import { useGeolocation } from "@/hooks/use-geolocation.ts";
import { useTilePrecache } from "@/hooks/use-tile-precache.ts";
import { motion } from "motion/react";
import FavoritesPanel from "./FavoritesPanel.tsx";
import NearbyStopsPanel from "./NearbyStopsPanel.tsx";
import RouteCarousel from "./RouteCarousel.tsx";
import RouteDetailPanel from "./RouteDetailPanel.tsx";
import RoutePolyline from "./RoutePolyline.tsx";
import SearchBar from "./SearchBar.tsx";
import StopDetailPanel from "./StopDetailPanel.tsx";
import TripPlannerPanel from "./TripPlannerPanel.tsx";
import ZoomStopMarkers from "./ZoomStopMarkers.tsx";
import OfflineBanner from "./OfflineBanner.tsx";
import { cn } from "@/lib/utils.ts";
import { SUPPORTED_LOCALES, SUPPORTED_LOCALES_ARRAY, setLocaleInPath, type SupportedLocale } from "@/i18n.ts";

// Fix Leaflet default icons
(L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl = undefined;
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

type PanelMode = "list" | "route" | "stop" | "planner" | "nearby" | "favorites";

const SHEET_SNAP_PEEK = 120;
const SHEET_SNAP_HALF = 0.55;
const SHEET_SNAP_FULL = 0.92;

function MapClickHandler({ onMapClick }: {onMapClick: () => void;}) {
  useMapEvents({ click: onMapClick });
  return null;
}

/** Compact toggle button — switches between EN and SQ */
function LangToggle() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const currentLng = i18n.language as SupportedLocale;

  const toggle = useCallback(() => {
    const next = SUPPORTED_LOCALES_ARRAY.find((l) => l !== currentLng) ?? "en";
    const newPath = setLocaleInPath(next, location.pathname, location.search, location.hash);
    navigate(newPath);
  }, [currentLng, location, navigate]);

  const next = SUPPORTED_LOCALES_ARRAY.find((l) => l !== currentLng) ?? "en";
  const nextMeta = SUPPORTED_LOCALES[next];
  const currentMeta = SUPPORTED_LOCALES[currentLng] ?? SUPPORTED_LOCALES.en;

  return (
    <button
      onClick={toggle}
      title={`Switch to ${nextMeta.nativeName}`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors cursor-pointer text-xs font-semibold shadow-sm">
      
      <span>{currentMeta.emoji}</span>
      <span className="uppercase tracking-wide">{currentMeta.code}</span>
    </button>);

}

export default function BusTracker() {
  const { t } = useTranslation("common");

  const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("list");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(SHEET_SNAP_PEEK);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(SHEET_SNAP_PEEK);

  // Geolocation
  const geo = useGeolocation();

  // Pre-cache map tiles for offline use
  useTilePrecache();

  // Road-snapped geometries

  const windowHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const halfSnap = Math.round(windowHeight * SHEET_SNAP_HALF);
  const fullSnap = Math.round(windowHeight * SHEET_SNAP_FULL);

  useEffect(() => {
    setSheetHeight(halfSnap);
  }, [panelMode, halfSnap]);

  const handleMapRef = useCallback((map: L.Map | null) => {
    mapRef.current = map;
  }, []);

  const handleSelectRoute = useCallback((route: BusRoute) => {
    setSelectedRoute(route);
    setSelectedStop(null);
    setPanelMode("route");
    if (mapRef.current && route.stops.length > 0) {
      const bounds = L.latLngBounds(route.stops.map((s) => [s.lat, s.lng]));
      mapRef.current.fitBounds(bounds, { padding: [60, 60] });
    }
    setSidebarOpen(true);
  }, []);

  const handleSelectStop = useCallback((stop: BusStop, route: BusRoute | null) => {
    setSelectedStop(stop);
    if (route) {
      setSelectedRoute(route);
      setPanelMode("route");
    } else {
      setPanelMode("stop");
    }
    if (mapRef.current) {
      mapRef.current.setView([stop.lat, stop.lng], 16, { animate: true });
    }
    setSidebarOpen(true);
  }, []);

  const handleStopDetail = useCallback((stop: BusStop) => {
    setSelectedStop(stop);
    setPanelMode("stop");
    if (mapRef.current) {
      mapRef.current.setView([stop.lat, stop.lng], 16, { animate: true });
    }
    setSidebarOpen(true);
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedRoute(null);
    setSelectedStop(null);
    setPanelMode("list");
    setSheetHeight(halfSnap);
  }, [halfSnap]);

  const handleOpenPlanner = useCallback(() => {
    setPanelMode("planner");
    setSidebarOpen(true);
    setSheetHeight(halfSnap);
  }, [halfSnap]);

  const handleOpenNearby = useCallback(() => {
    setPanelMode("nearby");
    setSidebarOpen(true);
    setSheetHeight(halfSnap);
    // Auto-request location when opening nearby panel
    if (geo.status === "idle") {
      geo.requestLocation();
    }
    // Center map on user if we have location
    if (geo.latitude !== null && geo.longitude !== null && mapRef.current) {
      mapRef.current.setView([geo.latitude, geo.longitude], 15, { animate: true });
    }
  }, [halfSnap, geo]);

  const handleOpenFavorites = useCallback(() => {
    setPanelMode("favorites");
    setSidebarOpen(true);
    setSheetHeight(halfSnap);
  }, [halfSnap]);

  const handleLocateMe = useCallback(() => {
    if (geo.status === "idle" || geo.status === "denied" || geo.status === "error") {
      geo.requestLocation();
    }
    if (geo.latitude !== null && geo.longitude !== null && mapRef.current) {
      mapRef.current.setView([geo.latitude, geo.longitude], 15, { animate: true });
    }
  }, [geo]);

  const filteredRoutes = activeArea ?
  BUS_ROUTES.filter((r) => getRouteAreas(r).includes(activeArea)) :
  BUS_ROUTES;

  const handleSheetDragStart = useCallback((clientY: number) => {
    dragStartY.current = clientY;
    dragStartHeight.current = sheetHeight;
  }, [sheetHeight]);

  const handleSheetDrag = useCallback((clientY: number) => {
    if (dragStartY.current === null) return;
    const delta = dragStartY.current - clientY;
    const next = Math.max(SHEET_SNAP_PEEK, Math.min(fullSnap, dragStartHeight.current + delta));
    setSheetHeight(next);
  }, [fullSnap]);

  const handleSheetDragEnd = useCallback(() => {
    dragStartY.current = null;
    const snaps = [SHEET_SNAP_PEEK, halfSnap, fullSnap];
    const nearest = snaps.reduce((a, b) =>
    Math.abs(a - sheetHeight) < Math.abs(b - sheetHeight) ? a : b
    );
    setSheetHeight(nearest);
  }, [sheetHeight, halfSnap, fullSnap]);

  const panelContent =
  <>
      {panelMode === "route" && selectedRoute ?
    <motion.div
      key="route"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" as const }}
      className="flex flex-col h-full min-h-0"
    >
          <RouteDetailPanel
        route={selectedRoute}
        selectedStop={selectedStop}
        onClose={handleClearAll}
        onStopClick={(stop) => handleSelectStop(stop, selectedRoute)} />
      
        </motion.div> :
    panelMode === "stop" && selectedStop ?
    <motion.div
      key="stop"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" as const }}
      className="flex flex-col h-full min-h-0"
    >
          <StopDetailPanel
        stop={selectedStop}
        activeRoute={selectedRoute}
        onClose={handleClearAll}
        onSelectRoute={handleSelectRoute} />
      
        </motion.div> :
    panelMode === "planner" ?
    <motion.div
      key="planner"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" as const }}
      className="flex flex-col h-full min-h-0"
    >
          <TripPlannerPanel
        onSelectRoute={handleSelectRoute}
        onClose={handleClearAll} />
      
        </motion.div> :
    panelMode === "nearby" ?
    <motion.div
      key="nearby"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" as const }}
      className="flex flex-col h-full min-h-0"
    >
          <NearbyStopsPanel
        latitude={geo.latitude}
        longitude={geo.longitude}
        locationStatus={geo.status}
        onRequestLocation={geo.requestLocation}
        onClose={handleClearAll}
        onSelectStop={(stop) => handleSelectStop(stop, null)}
        onSelectRoute={handleSelectRoute} />
      
        </motion.div> :
    panelMode === "favorites" ?
    <motion.div
      key="favorites"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" as const }}
      className="flex flex-col h-full min-h-0"
    >
          <FavoritesPanel
        onSelectRoute={handleSelectRoute}
        onClose={handleClearAll} />
      
        </motion.div> :

    <>
          {/* Area filter chips */}
          <div className="px-4 pb-2 border-b border-border/40 flex-shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              <button
            onClick={() => setActiveArea(null)}
            className={cn(
              "flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer",
              activeArea === null ?
              "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground hover:bg-accent"
            )}>
            
                {t("filter.all")}
              </button>
              {AREAS.map((area) =>
          <button
            key={area.id}
            onClick={() => setActiveArea(activeArea === area.id ? null : area.id)}
            className={cn(
              "flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer",
              activeArea === area.id ?
              "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground hover:bg-accent"
            )}>
            
                  {area.label}
                </button>
          )}
            </div>
          </div>

          {/* Trip Planner CTA */}
          <div className="px-4 py-3 flex-shrink-0 space-y-2">
            <button
          onClick={handleOpenPlanner}
          className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all cursor-pointer shadow-sm bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90">
          
              <div className="w-9 h-9 rounded-lg bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-bold leading-tight">{t("planner.cta_title")}</p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">{t("planner.cta_subtitle")}</p>
              </div>
              <ChevronDown className="-rotate-90 w-4 h-4 text-primary-foreground/60 flex-shrink-0" />
            </button>

            {/* Nearby Stops CTA */}
            <button
          onClick={handleOpenNearby}
          className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-all cursor-pointer border border-border hover:bg-accent/50">
          
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Locate className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold leading-tight">{t("nearby.title")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("nearby.subtitle")}</p>
              </div>
              <ChevronDown className="-rotate-90 w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
            </button>

            {/* Favorites CTA */}
            <button
          onClick={handleOpenFavorites}
          className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-all cursor-pointer border border-border hover:bg-accent/50">
          
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold leading-tight">{t("favorites.title")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("favorites.subtitle")}</p>
              </div>
              <ChevronDown className="-rotate-90 w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
            </button>
          </div>

          {/* Route carousel */}
          <RouteCarousel
        routes={filteredRoutes}
        selectedRoute={selectedRoute}
        onSelectRoute={handleSelectRoute} />
      

          <div className="px-4 py-3 border-t border-border/40 flex-shrink-0">
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-2.5">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("app.data_source")}
              </p>
            </div>
          </div>
        </>
    }
    </>;


  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">

      {/* ── DESKTOP: left sidebar ─────────────────────────────────────────── */}
      <div
        className={cn(
          "hidden md:flex flex-col bg-background border-r border-border flex-shrink-0 transition-all duration-300 z-10",
          sidebarOpen ? "md:w-80" : "md:w-0 md:overflow-hidden"
        )}>
        
        {/* Sidebar header */}
        <div className="px-4 pt-4 pb-3 border-b border-border/60 flex-shrink-0 bg-background">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Bus className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight">{t("app.title")}</h1>
                
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <LangToggle />
              <button
                onClick={handleOpenPlanner}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  panelMode === "planner" ?
                  "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                
                <Navigation className="w-3.5 h-3.5" />
                {t("plan_btn")}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          {panelContent}
        </div>
      </div>

      {/* ── MAP ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">

        {/* Desktop: sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="hidden md:flex absolute top-4 left-0 z-[1000] bg-background border border-border shadow-lg rounded-r-lg p-2 cursor-pointer hover:bg-accent transition-colors items-center">
          
          <ChevronDown
            className={cn("w-4 h-4 transition-transform", sidebarOpen ? "-rotate-90" : "rotate-90")} />
          
        </button>

        {/* Desktop: trip planner FAB when sidebar hidden */}
        {!sidebarOpen &&
        <button
          onClick={handleOpenPlanner}
          className="hidden md:flex absolute top-14 left-0 z-[1000] bg-primary text-primary-foreground border border-border shadow-lg rounded-r-lg px-3 py-2 cursor-pointer hover:opacity-90 transition-opacity items-center gap-1.5 text-xs font-semibold">
          
            <Navigation className="w-3.5 h-3.5" />
            {t("planner.cta_title")}
          </button>
        }

        {/* Desktop legend */}
        {panelMode === "list" &&
        <div className="hidden md:block absolute bottom-8 right-4 z-[1000] bg-background/95 backdrop-blur border border-border shadow-lg rounded-xl p-3 max-w-[200px]">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Routes</p>
            <div className="grid grid-cols-2 gap-1">
              {(activeArea ? filteredRoutes : BUS_ROUTES).slice(0, 8).map((r) =>
            <button
              key={r.id}
              onClick={() => handleSelectRoute(r)}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity">
              
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="text-xs text-foreground">{r.number}</span>
                </button>
            )}
            </div>
            {filteredRoutes.length > 8 &&
          <p className="text-xs text-muted-foreground mt-1">+{filteredRoutes.length - 8} more</p>
          }
          </div>
        }

        {/* Map controls */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          <button
            onClick={handleLocateMe}
            className={cn(
              "bg-background border border-border shadow-lg rounded-lg p-2 cursor-pointer hover:bg-accent transition-colors",
              geo.status === "granted" && "ring-2 ring-primary/50"
            )}
            title={t("nearby.title")}>
            
            <Locate className={cn("w-4 h-4", geo.status === "granted" ? "text-primary" : "text-muted-foreground")} />
          </button>
        </div>

        {/* Offline indicator */}
        <OfflineBanner />

        <MapContainer
          center={TIRANA_CENTER}
          zoom={13}
          className="w-full h-full"
          zoomControl={false}
          ref={handleMapRef}>
          
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a> &middot; Transit data &copy; <a href="https://tirana.al/">Municipality of Tirana</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>)' />
          
          <MapClickHandler onMapClick={() => {/* noop */}} />

          {/* User location marker */}
          {geo.status === "granted" && geo.latitude !== null && geo.longitude !== null &&
          <>
              <CircleMarker
              center={[geo.latitude, geo.longitude]}
              radius={12}
              pathOptions={{ color: "transparent", fillColor: "#3b82f6", fillOpacity: 0.15 }} />
            
              <CircleMarker
              center={[geo.latitude, geo.longitude]}
              radius={6}
              pathOptions={{ color: "#ffffff", weight: 2.5, fillColor: "#3b82f6", fillOpacity: 1 }} />
            
            </>
          }

          {BUS_ROUTES.map((route) => {
            const isFiltered = activeArea ? getRouteAreas(route).includes(activeArea) : true;
            return (
              <RoutePolyline
                key={route.id}
                route={route}
                isSelected={selectedRoute?.id === route.id}
                isHighlighted={panelMode === "list" && isFiltered}
                onStopClick={(stop, r) => {
                  if (selectedRoute?.id === r.id) handleStopDetail(stop);
                  else handleSelectStop(stop, r);
                }}
              />
            );
          })}

          {/* Show all stops when zoomed in */}
          <ZoomStopMarkers
            selectedRouteId={selectedRoute?.id ?? null}
            onStopClick={(stop, route) => {
              if (selectedRoute?.id === route.id) handleStopDetail(stop);
              else handleSelectStop(stop, route);
            }}
          />
        </MapContainer>

        {/* ── MOBILE: floating top bar ──────────────────────────────────── */}
        <div className="md:hidden absolute top-0 left-0 right-0 z-[1000] px-3 pt-3 pb-2 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* App badge */}
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Bus className="w-4 h-4 text-primary-foreground" />
            </div>

            {/* Lang toggle (replaces search bar on mobile top) */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <LangToggle />
            </div>

            {/* Plan button */}
            <button
              onClick={handleOpenFavorites}
              className={cn(
                "flex-shrink-0 h-9 px-3 rounded-xl flex items-center gap-1.5 shadow-lg border transition-all cursor-pointer text-xs font-semibold",
                panelMode === "favorites" ?
                "bg-amber-500 text-white border-amber-500" :
                "bg-background text-foreground border-border hover:bg-accent"
              )}>
              
              <Star className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleOpenNearby}
              className={cn(
                "flex-shrink-0 h-9 px-3 rounded-xl flex items-center gap-1.5 shadow-lg border transition-all cursor-pointer text-xs font-semibold",
                panelMode === "nearby" ?
                "bg-primary text-primary-foreground border-primary" :
                "bg-background text-foreground border-border hover:bg-accent"
              )}>
              
              <Locate className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleOpenPlanner}
              className={cn(
                "flex-shrink-0 h-9 px-3 rounded-xl flex items-center gap-1.5 shadow-lg border transition-all cursor-pointer text-xs font-semibold",
                panelMode === "planner" ?
                "bg-primary text-primary-foreground border-primary" :
                "bg-primary text-primary-foreground border-primary/80 hover:opacity-90"
              )}>
              
              <Navigation className="w-3.5 h-3.5" />
              <span>{t("mobile.plan")}</span>
            </button>
          </div>
        </div>

        {/* ── MOBILE: bottom sheet ──────────────────────────────────────── */}
        <div
          className="md:hidden absolute left-0 right-0 bottom-0 z-[999] bg-background rounded-t-2xl shadow-2xl border-t border-border flex flex-col"
          style={{ height: sheetHeight, transition: dragStartY.current ? "none" : "height 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
          
          {/* Drag handle */}
          <div
            className="flex-shrink-0 flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handleSheetDragStart(e.clientY);
            }}
            onPointerMove={(e) => handleSheetDrag(e.clientY)}
            onPointerUp={() => handleSheetDragEnd()}
            onPointerCancel={() => handleSheetDragEnd()}>
            
            <div className="w-10 h-1 rounded-full bg-border" />
            {(panelMode === "route" || panelMode === "stop" || panelMode === "planner" || panelMode === "nearby" || panelMode === "favorites") && sheetHeight <= halfSnap &&
            <div className="flex items-center justify-between w-full px-4 mt-2">
                <p className="text-sm font-semibold truncate">
                  {panelMode === "route" && selectedRoute ? `${t("route.line")} ${selectedRoute.number} · ${selectedRoute.name}` :
                panelMode === "stop" && selectedStop ? selectedStop.name :
                panelMode === "nearby" ? t("nearby.title") :
                panelMode === "favorites" ? t("favorites.title") :
                t("planner.title")}
                </p>
                <div className="flex items-center gap-2">
                  <button
                  onClick={() => setSheetHeight(fullSnap)}
                  className="p-1 text-muted-foreground cursor-pointer">
                  
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={handleClearAll} className="p-1 text-muted-foreground cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            }
            {panelMode === "list" && sheetHeight <= SHEET_SNAP_PEEK + 20 &&
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide w-full px-4 mt-2 pb-1">
                <button
                onClick={() => {setActiveArea(null);setSheetHeight(halfSnap);}}
                className={cn("flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer", activeArea === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {t("filter.all")}</button>
                {AREAS.map((area) =>
              <button key={area.id}
              onClick={() => {setActiveArea(activeArea === area.id ? null : area.id);setSheetHeight(halfSnap);}}
              className={cn("flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer", activeArea === area.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {area.label}</button>
              )}
              </div>
            }
          </div>

          {/* Sheet content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {panelContent}
          </div>
        </div>
      </div>
    </div>);

}