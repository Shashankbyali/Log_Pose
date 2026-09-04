<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LOG POSE — project notes

Product: **LOG POSE** — "The route to a safer tomorrow." Team: Straw Hats.
Safety-aware walking navigation for Bengaluru. (Repo folder is still
`exit-nav`; the old "EXIT" name must not appear in any user-facing text.)

## Verification commands

```bash
npm run lint       # eslint, must be clean
npx tsc --noEmit   # typecheck
npm run build      # production build
npm run dev        # dev server
```

`npm run lint` enforces `react-hooks/set-state-in-effect`: never call
`setState` synchronously in an effect body. Derive with `useMemo`, or call the
loader from the event handler instead.

## Non-negotiable product rules

1. **Live Mode uses real data only.** No hardcoded lamp counts, crowd levels,
   Safe Havens, opening hours or safety scores. No mock fallback when an API
   fails, and no mixing Demo Mode data into Live Mode.
2. **Missing data is never zero.** `null` inputs mean "unavailable"; the Safety
   Engine excludes them and renormalises the remaining weights. `Infinity` for
   `nearestEmergencyMeters` means "searched, none found" and does score 0.
   Zero mapped lamps in the whole queried box is reported as *unavailable*
   (unmapped), not as darkness.
3. **`safetyEngine.ts` and `trustScore.ts` must stay pure** — no fetching, no
   randomness, no `Date.now()`. Pass a `ClockNow` in for time-dependent logic.
4. **OSM establishments are not Safe Havens.** Grey neutral markers, labelled
   "Source: OpenStreetMap / Not LOG POSE Verified".
5. **Safe Havens require physical verification.** Approval is blocked until a
   field verification is recorded. Trust Score is calculated and returns 0 for
   anything not `verified`. It is enforced in the API, a DB `BEFORE INSERT`
   trigger, and RLS.
6. **Never claim safety.** Use "Safety Score", "safer route", "based on
   available data". Never "100% safe" or guaranteed.

## Gotchas discovered

- `router.project-osrm.org` **only hosts the car profile**. A `/foot/` request
  there returns driving durations. Use
  `https://routing.openstreetmap.de/routed-foot` (FOSSGIS), which is real
  walking (~4.5 km/h) and returns genuine alternatives.
- Route labels: `safest` is only assigned when a route genuinely scores higher
  than the fastest one; otherwise routes are labelled `alternative`. In central
  Bengaluru the main road is often both fastest and best-scoring — that is a
  correct result, not a bug.
- Overpass: one query per trip over a bbox around all candidate routes. Never
  query the whole city. Mirrors are tried in order with a 22 s timeout.
- `.gitignore` needs `!.env.example` because `.env*` would otherwise ignore
  the committed template.
- `turbopack.root` is pinned in `next.config.ts`; without it Turbopack walks up
  to the user's home directory looking for a lockfile.
- Client components must not import `lib/safeHavens.ts` (server data access).
  Use the pure `lib/safePlaceRanking.ts` instead.
- Server-only env vars: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`. Never add
  a `NEXT_PUBLIC_` prefix to them.

## Deployment

Vercel free tier, no extra services. `/api/plan` sets `maxDuration = 60`
because a cold Overpass mirror can be slow.
