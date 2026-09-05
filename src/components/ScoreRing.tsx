import { cn, formatScore, getScoreHex } from "@/lib/utils";

interface ScoreRingProps {
  /** 0-100, or null when the Safety Score could not be computed. */
  score: number | null;
  size?: number;
  strokeWidth?: number;
  caption?: string;
  className?: string;
}

/**
 * Circular Safety Score readout.
 *
 * A null score draws no arc at all and reads "--". An empty ring must look
 * clearly different from a zero score, because "not measured" and "measured as
 * bad" are different facts.
 */
export function ScoreRing({
  score,
  size = 64,
  strokeWidth = 5,
  caption,
  className,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = score === null ? 0 : Math.min(100, Math.max(0, score)) / 100;
  const colour = getScoreHex(score);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        score === null ? "Safety Score unavailable" : `Safety Score ${score} out of 100`
      }
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            style={{ transition: "stroke-dashoffset 500ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-semibold leading-none tabular-nums"
          style={{ color: colour, fontSize: size * 0.32 }}
        >
          {formatScore(score)}
        </span>
        {caption && (
          <span
            className="mt-0.5 uppercase tracking-wider text-zinc-500"
            style={{ fontSize: Math.max(8, size * 0.13) }}
          >
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
