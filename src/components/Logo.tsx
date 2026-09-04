interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * LOG POSE mark: a compass ring with a needle pointing along a route.
 * Navigation-led rather than a generic safety shield.
 */
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="LOG POSE"
    >
      <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
      <path
        d="M16 5.5v2.6M16 23.9v2.6M5.5 16h2.6M23.9 16h2.6"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Needle pointing north-east: the chosen route. */}
      <path d="M10.6 21.4 22 10l-3.4 11.4-3-3.3-5 3.3Z" fill="currentColor" />
      <circle cx="16" cy="16" r="1.6" fill="#09090b" />
    </svg>
  );
}
