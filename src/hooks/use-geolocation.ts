import { useCallback, useRef, useState } from "react";

export type GeolocationStatus = "idle" | "loading" | "granted" | "denied" | "unavailable" | "error";

export type GeolocationState = {
  status: GeolocationStatus;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
};

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    status: "idle",
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
  });

  const watchIdRef = useRef<number | null>(null);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState((prev) => ({ ...prev, status: "unavailable", error: "Geolocation not supported" }));
      return;
    }

    setState((prev) => ({ ...prev, status: "loading", error: null }));

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setState({
          status: "granted",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState((prev) => ({ ...prev, status: "denied", error: "Permission denied" }));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setState((prev) => ({ ...prev, status: "unavailable", error: "Position unavailable" }));
        } else {
          setState((prev) => ({ ...prev, status: "error", error: err.message }));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  return { ...state, requestLocation, stopWatching };
}
