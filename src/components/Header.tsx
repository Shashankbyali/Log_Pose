import Link from "next/link";
import { Logo } from "./Logo";
import { ModeBadge } from "./ModeBadge";
import type { DataMode } from "@/lib/types";

interface HeaderProps {
  mode?: DataMode | null;
  compact?: boolean;
}

export function Header({ mode = null, compact = false }: HeaderProps) {
  return (
    <header className="lp-glass sticky top-0 z-[1200] flex items-center justify-between gap-3 border-x-0 border-t-0 px-4 py-3">
      <Link href="/" className="lp-focus group flex items-center gap-2.5 rounded-lg">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-400/25 bg-teal-400/10 text-teal-300 transition group-hover:border-teal-400/45 group-hover:bg-teal-400/15">
          <Logo size={compact ? 20 : 22} />
        </span>
        <span className="leading-tight">
          <span className="lp-gradient-text block text-base font-semibold tracking-[0.16em]">
            LOG POSE
          </span>
          {!compact && (
            <span className="block text-[11px] text-zinc-500 group-hover:text-zinc-400">
              The route to a safer tomorrow.
            </span>
          )}
        </span>
      </Link>

      <div className="flex items-center gap-2">
        {mode && <ModeBadge mode={mode} />}
        <Link
          href="/register"
          className="lp-focus hidden rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/5 sm:block"
        >
          Register a Safe Haven
        </Link>
        <Link
          href="/admin"
          className="lp-focus rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          Admin
        </Link>
      </div>
    </header>
  );
}
