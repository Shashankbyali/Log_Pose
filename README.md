# LOG POSE

### The route to a safer tomorrow.

Built by **Straw Hats**.

Navigation apps optimise for getting you there. **LOG POSE adds a safety
intelligence layer** so you can choose _how_ you get there — comparing real
walking routes in Bengaluru using mapped street lighting, nearby activity,
pedestrian infrastructure, emergency access, and a **physically verified Safe
Haven network**.

---

## The hard rule: real data only

Live Mode never fabricates a number.

| Indicator                | Real source                                         |
| ------------------------ | --------------------------------------------------- |
| Walking routes & ETA     | OSRM `foot` profile (FOSSGIS / OpenStreetMap.de)    |
| Destination search       | Nominatim (OpenStreetMap)                           |
| Street lighting          | OSM `highway=street_lamp` within 40 m of the route  |
| Human activity           | OSM establishments within 60 m of the route         |
| Open establishments      | OSM `opening_hours`, parsed in Asia/Kolkata         |
| Pedestrian accessibility | OSM footways, sidewalks, crossings                  |
| Emergency access         | Distance to mapped hospitals, police, fire, clinics |
| Safe Haven availability  | LOG POSE verified network (Supabase)                |

When a source is unavailable the indicator reports **"Data unavailable"** and is
**excluded from the score with the remaining weights renormalised** — missing
data is never silently converted to zero, and never replaced with mock values.

A missing OSM street lamp does not mean there is no lamp, so all lighting
wording is _"based on mapped street-light infrastructure"_.

Demo Mode is always available and always labelled `DEMO MODE`. Its data is
predefined and never mixed with Live Mode data.

---

## Safety Score

Deterministic, explainable, and independent of any API call
(`src/lib/safetyEngine.ts` is a pure function — no fetching, no randomness, no
clock reads).

```
Safety Score = 0.25 x Lighting
             + 0.20 x Human activity
             + 0.20 x Safe Haven availability
             + 0.15 x Open establishments
             + 0.10 x Pedestrian accessibility
             + 0.10 x Emergency accessibility
```

Every factor exposes the measurement behind it, e.g.
_"90 mapped street lamps along route (15.5/km)"_.

**LOG POSE never claims a route is safe.** Safety is probabilistic and
data-dependent.

---

## Verified Safe Havens

> A business does not become a LOG POSE Safe Haven by registering. It must pass
> a physical verification visit by our team before receiving the designation.

```
Business applies  ->  Pending  ->  Under review  ->  Verifier assigned
  ->  Physical verification visit  ->  Verification report
  ->  Admin decision  ->  Verified / Rejected      (later: Suspended)
```

- OSM establishments appear as neutral grey markers labelled
  **"Source: OpenStreetMap / Not LOG POSE Verified"**.
- Verified Safe Havens get a distinct starred teal badge.
- **Trust Score** is calculated deterministically from the verified record
  (`src/lib/trustScore.ts`) and returns **0 for anything not verified**. A
  business can never choose, influence or purchase it.
- Trust Score (place reliability) is kept separate from Safety Score (route
  environment).

Enforced in three places so a client cannot self-verify: the API forces
`pending`, a database `BEFORE INSERT` trigger re-forces it, and RLS only
exposes `verification_status = 'verified'` rows publicly.

---

## Run locally

```bash
npm install
cp .env.example .env.local   # optional, see below
npm run dev
```

Open http://localhost:3000. **Routing and all OpenStreetMap safety indicators
work with zero configuration.**

### Environment variables

All optional. See `.env.example`.

| Variable                        | Needed for                          |
| ------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Verified Safe Haven network         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Verified Safe Haven network         |
| `SUPABASE_SERVICE_ROLE_KEY`     | `/admin` workflow — **server only** |
| `ADMIN_TOKEN`                   | `/admin` login — **server only**    |
| `NEXT_PUBLIC_OSRM_URL`          | Override the walking router         |
| `OVERPASS_URL`                  | Override the Overpass endpoint      |

Without Supabase, the app still routes and scores; Safe Haven availability is
honestly reported as unavailable.

> Do not point `NEXT_PUBLIC_OSRM_URL` at `router.project-osrm.org`. That demo
> server only hosts the **car** profile, so it returns driving times for
> walking requests.

### Supabase setup (for the Safe Haven network)

1. Create a free project at [supabase.com](https://supabase.com).
2. SQL Editor → New query → paste all of `supabase/schema.sql` → Run.
   This creates the tables, the status-forcing trigger and the RLS policies.
3. Project Settings → API → copy the Project URL, the `anon` key and the
   `service_role` secret into your env vars.
4. Set `ADMIN_TOKEN` to a long random string
   (`openssl rand -base64 32`).

---

## Deploy (Vercel free tier)

```bash
npm i -g vercel && vercel
```

Or import the repo at [vercel.com/new](https://vercel.com/new).

1. Framework preset: **Next.js** (detected automatically).
2. Set the environment variables above in _Project Settings → Environment
   Variables_. Add `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_TOKEN` **without** the
   `NEXT_PUBLIC_` prefix so they stay server-side.
3. Deploy.

No Docker, Redis, queues or extra services. `/api/plan` declares
`maxDuration = 60` because one Overpass query can be slow on a cold mirror.

---

## Architecture

```
src/lib/
  geo.ts                  haversine, point-to-polyline, bbox, polyline decode
  routing.ts              real OSRM walking routes + label assignment
  overpass.ts             one Overpass query per trip, with mirror fallback
  openingHours.ts         OSM opening_hours subset parser (returns "unknown")
  safetyInputs.ts         OSM data -> measured corridor values
  safetyEngine.ts         pure deterministic Safety Score
  trustScore.ts           pure deterministic Safe Haven Trust Score
  safeHavens.ts           verified network access (Supabase, no mock fallback)
  demoData.ts             DEMO MODE only, scored by the real engine
src/app/api/
  plan/                   the Live Mode pipeline
  geocode/                Nominatim search (debounced client-side)
  safe-places/            "I need a safe place"
  safe-havens/            public verified list + application submission
  admin/applications/     verification workflow (token-gated)
```

One Overpass request per trip, over a bounding box around the candidate routes
only — never the whole city.

---

## Privacy by design

- No account, no personal details, no user identifiers.
- One-shot geolocation only; there is deliberately no `watchPosition`.
- Your location is used for the current request and never stored.
- Finding a Safe Haven does not require your identity.
- Applicant contact details are stored but excluded from every public API
  response.

---

## Attribution

Map data © OpenStreetMap contributors (ODbL). Routing by OSRM via FOSSGIS.
Search and POI data via Nominatim and the Overpass API.
