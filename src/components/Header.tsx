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
    <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur-md">
      <Link href="/" className="group flex items-center gap-2.5">
        <span className="text-teal-400">
          <Logo size={compact ? 24 : 28} />
        </span>
        <span className="leading-tight">
          <span className="block text-base font-semibold tracking-[0.14em] text-white">
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
          className="hidden rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/5 sm:block"
        >
          Register a Safe Haven
        </Link>
        <Link
          href="/admin"
          className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          Admin
        </Link>
      </div>
    </header>
  );
}
