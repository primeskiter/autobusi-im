import { useCallback, useSyncExternalStore } from "react";

export type FavoriteLabel = "home" | "work" | "school" | "custom";

export type FavoriteStop = {
  routeId: string;
  /** The stop you board at — this is the whole point of the favorite: a
   * direct line to "when's my bus at my stop" with zero extra digging. */
  boardingStopName: string;
  /** Optional — where you get off. Purely informational, doesn't affect
   * the countdown, which is always based on the boarding stop. */
  alightingStopName?: string;
  label: FavoriteLabel;
  customName?: string;
  addedAt: string;
};

const STORAGE_KEY = "tirana-bus-favorites";

function isValidFavorite(v: unknown): v is FavoriteStop {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  return typeof f.routeId === "string" && typeof f.boardingStopName === "string" && typeof f.label === "string";
}

function getSnapshot(): FavoriteStop[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    // Filter out anything saved under the old route-only shape (no
    // boardingStopName) so stale data from before this update doesn't break.
    return Array.isArray(parsed) ? parsed.filter(isValidFavorite) : [];
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

function persist(favorites: FavoriteStop[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  cachedFavorites = favorites;
  window.dispatchEvent(new Event("favorites-updated"));
}

function sameFavorite(a: { routeId: string; boardingStopName: string; label: FavoriteLabel }, b: FavoriteStop) {
  return a.routeId === b.routeId && a.boardingStopName === b.boardingStopName && a.label === b.label;
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshotCached, () => []);

  const addFavorite = useCallback(
    (
      routeId: string,
      boardingStopName: string,
      label: FavoriteLabel,
      options?: { alightingStopName?: string; customName?: string }
    ) => {
      const current = getSnapshot();
      const key = { routeId, boardingStopName, label };
      // Don't add duplicates
      if (current.some((f) => sameFavorite(key, f))) return;
      const next = [
        ...current,
        {
          routeId,
          boardingStopName,
          alightingStopName: options?.alightingStopName,
          label,
          customName: options?.customName,
          addedAt: new Date().toISOString(),
        },
      ];
      persist(next);
    },
    []
  );

  const removeFavorite = useCallback((routeId: string, boardingStopName: string, label: FavoriteLabel) => {
    const current = getSnapshot();
    const key = { routeId, boardingStopName, label };
    const next = current.filter((f) => !sameFavorite(key, f));
    persist(next);
  }, []);

  const isFavorite = useCallback(
    (routeId: string) => {
      return favorites.some((f) => f.routeId === routeId);
    },
    [favorites]
  );

  const getFavoriteLabels = useCallback(
    (routeId: string) => {
      return favorites.filter((f) => f.routeId === routeId).map((f) => f.label);
    },
    [favorites]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite, getFavoriteLabels };
}
