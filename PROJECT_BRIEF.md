# LOG POSE — Project Handoff Brief

> **Product:** LOG POSE  
> **Tagline:** "The route to a safer tomorrow."  
> **Team:** Straw Hats  
> **Concept:** Navigation with a safety-intelligence layer — compare walking routes by real-world safety indicators, not just ETA.

## Current state

The hackathon MVP (`exit-nav`) has been upgraded to a real-data Bengaluru prototype. As of the latest run:

- `npm run lint` ✅
- `npm run build` ✅
- `next dev` runs on `http://localhost:3000` with the new manual-vs-GPS origin selector.
- Live `/api/plan` returns real OSM walking routes and real safety measurements.
- Live `/api/geocode` returns real Nominatim results.
- Demo Mode still works and is clearly labeled.

## Tech stack

- Next.js 16.3.4 App Router
- React 19.2.8 + TypeScript
- Tailwind CSS 4
- Leaflet + OpenStreetMap
- Nominatim / Overpass API / OSRM (FOSSGIS `routed-foot`)
- Supabase for verified Safe Havens (optional until configured)

## What is working

- Home screen with manual starting-point search + "Use my current location"
- Destination search (Nominatim, debounced)
- Route planning with real walking routes + real alternatives
- Safety Score engine using six real/measurement-backed factors (lighting, activity, open establishments, pedestrian accessibility, emergency accessibility, Safe Haven availability)
- Honest unavailable-data handling (missing data is not scored as zero)
- Route comparison cards: `FASTEST`, `BALANCED`, `SAFEST`, `alternative`
- No-trade-off messaging when the fastest route is also the safest
- Live/Demo mode distinction
- Map with route lines, OSM places, and verified Safe Haven markers
- `/register` public Safe Haven application page
- `/admin` dashboard with password-token auth and physical-verification gate
- Privacy-by-design copy and probabilistic safety language

## What is **not** configured yet

Supabase needs a real project and these env vars:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_TOKEN=
```

Run `supabase/schema.sql` on the new Supabase project. Until then, Safe Haven/registration/admin flows return honest `503` errors.

## Deployment target

Vercel free tier. Keep it simple: no Docker, no Redis, no paid APIs. `next.config.ts` and `package.json` are ready. Public routing uses FOSSGIS OSRM and OSM/Nominatim/Overpass.

## Key file map

- `src/components/LogPoseApp.tsx` — main orchestrator
- `src/components/HomeScreen.tsx` — origin/destination UI
- `src/components/PlaceSearch.tsx` — shared Nominatim search
- `src/lib/routing.ts` — OSRM walking routing + via-point alternatives
- `src/lib/safetyEngine.ts` — deterministic safety scoring with nullable factors
- `src/lib/overpass.ts` — OSM safety-input queries
- `src/lib/safeHavens.ts` — Supabase Safe Haven data layer
- `src/app/api/plan/route.ts` — route planning API
- `src/app/api/geocode/route.ts` — Nominatim proxy
- `src/app/api/safe-places/route.ts` — "I need a safe place"
- `src/app/api/safe-havens/route.ts` — public Safe Haven list
- `src/app/register/page.tsx` — Safe Haven application
- `src/app/admin/page.tsx` + `src/app/api/admin/applications/*` — admin workflow
- `supabase/schema.sql` — DB schema + RLS policies

## Remaining tasks

1. Create/configure a Supabase project and run `supabase/schema.sql`.
2. Set env vars and test `/register`, `/admin`, Safe Place flow, and verified Safe Havens.
3. Deploy to Vercel and confirm env vars there.
4. Mobile/layout sanity check and final browser QA.

## Important rules for continuation

- Never claim a route/place is "100% safe", "completely safe", or "guaranteed safe".
- Live Mode must only use real data. Do not fabricate scores, havens, or routes.
- Demo Mode must be clearly labeled and never mixed with live data.
- Keep admin token and Supabase service-role key server-only (no `NEXT_PUBLIC_`).
- Browser GPS may be outside Bengaluru; the manual origin selector is the fix for that.
- See `AGENTS.md` and `README.md` for Next.js agent rules and deployment notes.
