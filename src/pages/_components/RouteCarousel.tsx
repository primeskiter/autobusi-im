import type { BusRoute } from "@/data/tirana-bus-data.ts";
import RouteBusCard from "./RouteBusCard.tsx";

type Props = {
  routes: BusRoute[];
  selectedRoute: BusRoute | null;
  onSelectRoute: (route: BusRoute) => void;
};

export default function RouteCarousel({ routes, selectedRoute, onSelectRoute }: Props) {
  if (routes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-3">
      {routes.map((route, idx) => (
        <RouteBusCard
          key={route.id}
          route={route}
          index={idx}
          isSelected={selectedRoute?.id === route.id}
          onClick={() => onSelectRoute(route)}
        />
      ))}
    </div>
  );
}
