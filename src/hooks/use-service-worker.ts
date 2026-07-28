import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Registers the service worker and handles update notifications.
 * The SW uses cache-first for static assets and network-first for navigation,
 * ensuring the app loads instantly even when offline.
 */
export function useServiceWorker() {
  const toastShown = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const showUpdateToast = () => {
      if (toastShown.current) return;
      toastShown.current = true;

      toast("A new version is available!", {
        duration: Infinity,
        action: {
          label: "Refresh",
          onClick: () => {
            // Tell waiting SW to activate, then reload
            navigator.serviceWorker.getRegistration().then((reg) => {
              if (reg?.waiting) {
                reg.waiting.postMessage({ type: "SKIP_WAITING" });
              }
              window.location.reload();
            });
          },
        },
      });
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // If a new version is already waiting
        if (registration.waiting) {
          showUpdateToast();
          return;
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });

        // Check for updates periodically (every 30 minutes)
        setInterval(
          () => {
            registration.update();
          },
          30 * 60 * 1000,
        );
      })
      .catch((err) => console.log("Service Worker registration failed:", err));

    // When the controlling SW changes, reload for latest content
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);
}
