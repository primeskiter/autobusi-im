import { useEffect, useState } from "react";

/**
 * Returns a tick value that increments every `intervalMs` milliseconds.
 * Components that use this hook will re-render on each tick,
 * allowing countdown values to stay fresh.
 */
export function useCountdownTick(intervalMs = 30000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((prev) => prev + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
