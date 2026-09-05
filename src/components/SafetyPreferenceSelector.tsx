"use client";

import { cn } from "@/lib/utils";
import type { SafetyPreference } from "@/lib/types";

const OPTIONS: Array<{ value: SafetyPreference; label: string; desc: string }> =
  [
    { value: "fastest", label: "FASTEST", desc: "Prioritize travel time" },
    { value: "balanced", label: "BALANCED", desc: "Balance time & safety" },
    { value: "safest", label: "SAFEST", desc: "Prioritize Safety Score" },
  ];

interface SafetyPreferenceSelectorProps {
  value: SafetyPreference;
  onChange: (value: SafetyPreference) => void;
  compact?: boolean;
}

export function SafetyPreferenceSelector({
  value,
  onChange,
  compact = false,
}: SafetyPreferenceSelectorProps) {
  return (
    <div
      className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}
      role="radiogroup"
      aria-label="Safety preference"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            suppressHydrationWarning
            className={cn(
              "lp-focus rounded-xl border px-3 py-3 text-left transition-all",
              selected
                ? "border-teal-400/55 bg-gradient-to-b from-teal-400/18 to-teal-500/8 shadow-[0_0_22px_rgba(45,212,191,0.16)]"
                : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
            )}
          >
            <span
              className={cn(
                "block text-xs font-bold tracking-wider",
                selected ? "text-teal-300" : "text-zinc-300",
              )}
            >
              {option.label}
            </span>
            {!compact && (
              <span className="mt-1 block text-xs text-zinc-500">
                {option.desc}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
