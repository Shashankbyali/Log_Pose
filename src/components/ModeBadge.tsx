import type { DataMode } from "@/lib/types";

/**
 * Live and Demo data must never be confused, so the active mode is always
 * labelled explicitly.
 */
export function ModeBadge({ mode }: { mode: DataMode }) {
  if (mode === "demo") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300"
        role="status"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Demo Mode
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-300"
      role="status"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
      Live &mdash; Bengaluru
    </span>
  );
}

export function DemoModeBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-xs text-amber-200"
      role="status"
    >
      <span className="font-semibold uppercase tracking-wider">Demo Mode</span>
      <span className="text-amber-200/75">
        Predefined demonstration data. Not live measurements.
      </span>
    </div>
  );
}
