type Props = {
  color: string;
  className?: string;
};

/**
 * Lighten/darken a hex color by a percentage (-1..1). Positive lightens
 * toward white, negative darkens toward black. Used so the roof, skirt, and
 * outline are derived straight from the route's own color instead of a flat
 * white overlay - that's what keeps the bus reading as a bus even when a
 * card's scrim/opacity changes, no matter which route color it is.
 */
function shade(hex: string, percent: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  if (percent >= 0) {
    r = r + (255 - r) * percent;
    g = g + (255 - g) * percent;
    b = b + (255 - b) * percent;
  } else {
    r = r * (1 + percent);
    g = g * (1 + percent);
    b = b * (1 + percent);
  }

  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * A bold, detailed side-profile bus illustration, tinted per-route. We don't
 * have real photos of Tirana's buses (and using scraped photos would be a
 * copyright problem), so this is an original illustration: a clear vehicle
 * silhouette with a dark tinted-glass window band that stays legible against
 * any route color or background fade, a darker roof/skirt/outline shaded
 * from the route color itself, headlight, mirror, and wheels sitting in
 * proper wheel wells.
 */
export default function BusIllustration({ color, className }: Props) {
  const roof = shade(color, -0.28);
  const skirt = shade(color, -0.35);
  const outline = shade(color, -0.5);
  const sign = shade(color, 0.75);
  const glassTop = "#3f4b5f";
  const glassBottom = "#1e293b";
  const gradientId = `bus-glass-${color.replace("#", "")}`;

  return (
    <svg viewBox="0 0 300 140" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={glassTop} />
          <stop offset="100%" stopColor={glassBottom} />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="150" cy="122" rx="140" ry="8" fill="black" opacity="0.15" />

      {/* Body silhouette */}
      <path
        d="M 20 100 L 20 46 Q 20 30 36 30 L 250 30 Q 268 30 278 42 L 292 62 Q 296 68 296 76 L 296 100 Q 296 108 288 108 L 28 108 Q 20 108 20 100 Z"
        fill={color}
        stroke={outline}
        strokeWidth="3"
      />

      {/* Roof band */}
      <path d="M 20 46 Q 20 30 36 30 L 250 30 Q 268 30 278 42 L 282 47 L 20 47 Z" fill={roof} />

      {/* Bottom skirt */}
      <rect x="20" y="92" width="276" height="16" fill={skirt} />

      {/* Destination sign */}
      <rect x="34" y="36" width="40" height="9" rx="2" fill={sign} />

      {/* Windshield */}
      <path d="M 254 40 L 276 40 L 290 60 L 262 60 Z" fill={`url(#${gradientId})`} stroke={outline} strokeWidth="1.5" />

      {/* Window band */}
      <rect x="34" y="50" width="216" height="34" rx="6" fill={`url(#${gradientId})`} stroke={outline} strokeWidth="1.5" />

      {/* Window mullions */}
      <line x1="78" y1="50" x2="78" y2="84" stroke={outline} strokeWidth="2" />
      <line x1="122" y1="50" x2="122" y2="84" stroke={outline} strokeWidth="2" />
      <line x1="166" y1="50" x2="166" y2="84" stroke={outline} strokeWidth="2" />
      <line x1="210" y1="50" x2="210" y2="84" stroke={outline} strokeWidth="2" />

      {/* Door line */}
      <line x1="216" y1="88" x2="216" y2="106" stroke={outline} strokeWidth="2" opacity="0.6" />

      {/* Headlight */}
      <circle cx="286" cy="80" r="5" fill="#fde68a" stroke={outline} strokeWidth="1.5" />

      {/* Mirror */}
      <rect x="278" y="52" width="8" height="5" rx="1.5" fill={outline} />

      {/* Wheel wells */}
      <circle cx="76" cy="106" r="20" fill={outline} />
      <circle cx="240" cy="106" r="20" fill={outline} />

      {/* Wheels */}
      <circle cx="76" cy="106" r="16" fill="#111827" />
      <circle cx="76" cy="106" r="7" fill="#9ca3af" />
      <circle cx="240" cy="106" r="16" fill="#111827" />
      <circle cx="240" cy="106" r="7" fill="#9ca3af" />
    </svg>
  );
}
