import { useCallback, useSyncExternalStore } from "react";

export type FavoriteLabel = "home" | "work" | "school" | "custom";

export type FavoriteRoute = {
  routeId: string;
  label: FavoriteLabel;
  customName?: string;
  addedAt: string;
};

const STORAGE_KEY = "tirana-bus-favorites";

function getSnapshot(): FavoriteRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FavoriteRoute[];
  } catch {
    return [];
  }
}

let cachedFavorites = getSnapshot();

function subscribe(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedFavorites = getSnapshot();
      callback();
    }
  };
  window.addEventListener("storage", handler);

  // Also listen for custom event for same-tab updates
  const customHandler = () => {
    cachedFavorites = getSnapshot();
    callback();
  };
  window.addEventListener("favorites-updated", customHandler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("favorites-updated", customHandler);
  };
}

function getSnapshotCached() {
  return cachedFavorites;
}

function persist(favorites: FavoriteRoute[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  cachedFavorites = favorites;
  window.dispatchEvent(new Event("favorites-updated"));
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshotCached, () => []);

  const addFavorite = useCallback((routeId: string, label: FavoriteLabel, customName?: string) => {
    const current = getSnapshot();
    // Don't add duplicates
    if (current.some((f) => f.routeId === routeId && f.label === label)) return;
    const next = [...current, { routeId, label, customName, addedAt: new Date().toISOString() }];
    persist(next);
  }, []);

  const removeFavorite = useCallback((routeId: string, label: FavoriteLabel) => {
    const current = getSnapshot();
    const next = current.filter((f) => !(f.routeId === routeId && f.label === label));
    persist(next);
  }, []);

  const isFavorite = useCallback((routeId: string) => {
    return favorites.some((f) => f.routeId === routeId);
  }, [favorites]);

  const getFavoriteLabels = useCallback((routeId: string) => {
    return favorites.filter((f) => f.routeId === routeId).map((f) => f.label);
  }, [favorites]);

  return { favorites, addFavorite, removeFavorite, isFavorite, getFavoriteLabels };
}
