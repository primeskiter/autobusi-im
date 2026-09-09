type Props = {
  color: string;
  className?: string;
};

/**
 * A simple, clean side-profile bus illustration, tinted per-route. We don't
 * have real photos of Tirana's buses, so this gives each route card a
 * consistent "picture of a bus" visual that still reads as bold and
 * recognizable at decorative/background scale, and picks up the route's
 * own color for identity.
 */
export default function BusIllustration({ color, className }: Props) {
  return (
    <svg viewBox="0 0 300 140" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="15" y="28" width="270" height="76" rx="16" fill={color} />
      {/* Roof sheen */}
      <rect x="15" y="28" width="270" height="16" rx="16" fill="white" opacity="0.15" />
      {/* Bottom skirt */}
      <rect x="15" y="88" width="270" height="16" fill={color} opacity="0.85" />
      {/* Windshield taper at the front (right side) */}
      <path d="M 255 32 L 285 44 L 285 88 L 255 100 Z" fill="white" opacity="0.22" />
      {/* Windows */}
      <rect x="34" y="42" width="34" height="30" rx="5" fill="white" opacity="0.92" />
      <rect x="76" y="42" width="34" height="30" rx="5" fill="white" opacity="0.92" />
      <rect x="118" y="42" width="34" height="30" rx="5" fill="white" opacity="0.92" />
      <rect x="160" y="42" width="34" height="30" rx="5" fill="white" opacity="0.92" />
      <rect x="202" y="42" width="34" height="30" rx="5" fill="white" opacity="0.92" />
      <rect x="248" y="46" width="24" height="26" rx="5" fill="white" opacity="0.75" />
      {/* Door line */}
      <line x1="222" y1="42" x2="222" y2="104" stroke="black" strokeOpacity="0.12" strokeWidth="2" />
      {/* Front bumper accent */}
      <rect x="278" y="80" width="10" height="10" rx="2" fill="white" opacity="0.5" />
      {/* Wheels */}
      <circle cx="72" cy="106" r="17" fill="#1f2937" />
      <circle cx="72" cy="106" r="7" fill="#9ca3af" />
      <circle cx="228" cy="106" r="17" fill="#1f2937" />
      <circle cx="228" cy="106" r="7" fill="#9ca3af" />
    </svg>
  );
}
