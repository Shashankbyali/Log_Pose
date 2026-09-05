import { cn } from "@/lib/utils";
import type { OpenState } from "@/lib/types";
import { describeOpenState } from "@/lib/openingHours";

/**
 * Provenance badges.
 *
 * These two badges are deliberately different in colour, shape and wording so
 * an unverified OpenStreetMap establishment can never be mistaken for a
 * physically verified LOG POSE Safe Haven.
 */

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-teal-400/35 bg-teal-400/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300",
        className,
      )}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" />
      </svg>
      LOG POSE Verified
    </span>
  );
}

export function UnverifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-400/40 bg-slate-400/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-300",
        className,
      )}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2zm0-4h-2V7h2z" />
      </svg>
      Not verified
    </span>
  );
}

const OPEN_STATE_STYLE: Record<OpenState, string> = {
  open: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  closed: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  unknown: "border-white/12 bg-white/5 text-zinc-400",
};

export function OpenStatePill({ state }: { state: OpenState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        OPEN_STATE_STYLE[state],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {describeOpenState(state)}
    </span>
  );
}
