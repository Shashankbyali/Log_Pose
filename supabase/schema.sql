-- =====================================================================
-- LOG POSE -- Safe Haven network schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Safe Haven applications and verified Safe Havens live in one table,
-- separated by `verification_status`. A row only represents a real
-- "LOG POSE SAFE HAVEN" once verification_status = 'verified'.
-- ---------------------------------------------------------------------
create table if not exists public.safe_havens (
  id uuid primary key default gen_random_uuid(),

  -- Establishment
  name text not null,
  type text not null,
  description text default '',
  address text not null,
  city text not null default 'Bengaluru',
  pincode text not null,
  phone text not null,
  latitude double precision not null,
  longitude double precision not null,

  -- Operating information
  opening_hours text,
  is_24_7 boolean not null default false,
  employee_count integer,
  staff_available boolean not null default false,
  security_available boolean not null default false,
  security_hours text,
  female_staff_available boolean not null default false,

  -- Safe-space facilities
  safe_room boolean not null default false,
  waiting_area boolean not null default false,
  seating boolean not null default false,
  restroom boolean not null default false,
  temporary_shelter boolean not null default false,
  staff_assistance boolean not null default false,

  -- Emergency facilities
  first_aid boolean not null default false,
  cctv boolean not null default false,
  emergency_exit boolean not null default false,
  fire_extinguisher boolean not null default false,
  emergency_alarm boolean not null default false,

  -- Accessibility
  wheelchair_accessible boolean not null default false,
  accessible_entrance boolean not null default false,
  accessible_restroom boolean not null default false,
  elevator boolean not null default false,

  -- Assistance capabilities
  assistance_options text[] not null default '{}',

  -- Private contact details. Never selected by the public API.
  contact_person_name text,
  contact_person_phone text,

  -- Verification workflow
  verification_status text not null default 'pending'
    check (verification_status in (
      'pending', 'under_review', 'field_verification',
      'verified', 'rejected', 'suspended'
    )),
  assigned_verifier text,
  verification_notes text,
  field_verification_completed boolean not null default false,
  field_verified_at timestamptz,

  -- Calculated by the LOG POSE Trust Score engine, never self-selected.
  trust_score integer not null default 0 check (trust_score between 0 and 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,

  constraint safe_havens_lat_range check (latitude between -90 and 90),
  constraint safe_havens_lng_range check (longitude between -180 and 180)
);

create index if not exists safe_havens_status_idx
  on public.safe_havens (verification_status);
create index if not exists safe_havens_location_idx
  on public.safe_havens (latitude, longitude);

-- ---------------------------------------------------------------------
-- Audit trail of physical verification visits.
-- ---------------------------------------------------------------------
create table if not exists public.safe_haven_verifications (
  id uuid primary key default gen_random_uuid(),
  safe_haven_id uuid not null references public.safe_havens (id) on delete cascade,
  verifier_name text not null,
  visited_at timestamptz not null default now(),
  establishment_exists boolean not null default false,
  location_correct boolean not null default false,
  hours_confirmed boolean not null default false,
  staff_confirmed boolean not null default false,
  facilities_confirmed boolean not null default false,
  willing_to_assist boolean not null default false,
  report text not null,
  outcome text not null check (outcome in ('passed', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists safe_haven_verifications_haven_idx
  on public.safe_haven_verifications (safe_haven_id);

-- ---------------------------------------------------------------------
-- Hard guarantee: a client can never self-verify or set a Trust Score.
-- Applies even if an RLS policy is later loosened by mistake.
-- ---------------------------------------------------------------------
create or replace function public.force_pending_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.verification_status := 'pending';
  new.trust_score := 0;
  new.field_verification_completed := false;
  new.field_verified_at := null;
  new.verified_at := null;
  new.assigned_verifier := null;
  new.verification_notes := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists safe_havens_force_pending on public.safe_havens;
create trigger safe_havens_force_pending
  before insert on public.safe_havens
  for each row execute function public.force_pending_application();

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- anon/authenticated may:
--   * read ONLY verified Safe Havens
--   * insert a new application (forced to 'pending' by the trigger above)
-- They may never update or delete. All workflow transitions happen through
-- server-side routes using the service-role key.
-- ---------------------------------------------------------------------
alter table public.safe_havens enable row level security;
alter table public.safe_haven_verifications enable row level security;

drop policy if exists "verified safe havens are public" on public.safe_havens;
create policy "verified safe havens are public"
  on public.safe_havens
  for select
  to anon, authenticated
  using (verification_status = 'verified');

drop policy if exists "anyone may apply" on public.safe_havens;
create policy "anyone may apply"
  on public.safe_havens
  for insert
  to anon, authenticated
  with check (true);

-- No select/insert/update/delete policies for verification reports, so they
-- are readable only via the service-role key on the server.

-- =====================================================================
-- SAFE WALK -- overdue arrival escalation
--
-- When someone heads for a safe place, they can start a "Safe Walk": a
-- deadline is recorded server-side, and if they do not confirm arrival by
-- then the walk is escalated.
--
-- The deadline MUST live here rather than in a browser timer, because a
-- closed tab or a sleeping phone would otherwise silently cancel the only
-- safety mechanism the user is relying on.
--
-- PRIVACY -- this is the one place LOG POSE stores a location beyond the
-- current request, and only because an escalation is worthless without
-- knowing where the person was heading. Accordingly:
--   * there is no account, no name and no phone number on this row
--   * the device proves ownership with a random token, nothing identifying
--   * rows are purged by `purge_expired_safe_walks()` shortly after they
--     resolve, so this is a short-lived operational record, not history
-- =====================================================================
create table if not exists public.safe_walks (
  id uuid primary key default gen_random_uuid(),

  -- Opaque per-walk secret held only by the originating device. This is the
  -- sole means of confirming arrival or cancelling, so no account is needed.
  device_token text not null,

  -- Where they set out from and where they are heading.
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  destination_name text not null,

  -- 'verified_haven' escalates to a real Safe Haven we hold contact details
  -- for. 'osm_place' cannot be contacted by LOG POSE at all, and the UI must
  -- say so rather than implying someone is expecting the person.
  destination_kind text not null
    check (destination_kind in ('verified_haven', 'osm_place')),
  safe_haven_id uuid references public.safe_havens (id) on delete set null,

  -- Real OSRM walking estimate plus the grace period the user chose.
  expected_walk_seconds integer not null,
  grace_seconds integer not null,
  expected_arrival_at timestamptz not null,

  -- Nearest mapped police station at the time the walk started, captured so
  -- the escalation does not depend on Overpass being up later. `null` means
  -- none was mapped nearby -- never a placeholder.
  police_name text,
  police_lat double precision,
  police_lng double precision,
  police_phone text,

  status text not null default 'active'
    check (status in ('active', 'arrived', 'overdue', 'cancelled')),

  created_at timestamptz not null default now(),
  arrived_at timestamptz,
  overdue_at timestamptz,
  cancelled_at timestamptz,

  -- Set by the cron sweep so an alert is raised exactly once.
  escalated_at timestamptz
);

create index if not exists safe_walks_due_idx
  on public.safe_walks (status, expected_arrival_at);

-- ---------------------------------------------------------------------
-- Alerts raised when a Safe Walk goes overdue.
--
-- `channel` records what LOG POSE actually did, not what it wishes it could
-- do. 'dashboard' is the only channel that is genuinely delivered today;
-- police are NEVER contacted programmatically and no row here may claim
-- otherwise.
-- ---------------------------------------------------------------------
create table if not exists public.safe_walk_alerts (
  id uuid primary key default gen_random_uuid(),
  safe_walk_id uuid not null references public.safe_walks (id) on delete cascade,
  channel text not null check (channel in ('dashboard', 'safe_haven', 'device_handoff')),
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists safe_walk_alerts_walk_idx
  on public.safe_walk_alerts (safe_walk_id);

-- ---------------------------------------------------------------------
-- Retention: resolved walks are short-lived operational records.
-- Called by the same cron sweep that raises alerts.
-- ---------------------------------------------------------------------
create or replace function public.purge_expired_safe_walks()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.safe_walks
  where (status in ('arrived', 'cancelled') and created_at < now() - interval '1 hour')
     or (status = 'overdue' and created_at < now() - interval '7 days');
$$;

-- ---------------------------------------------------------------------
-- RLS: Safe Walks are written and read only through server routes using the
-- service-role key. A client holding a device token talks to our API, never
-- to PostgREST directly, so there are deliberately no anon policies here.
-- ---------------------------------------------------------------------
alter table public.safe_walks enable row level security;
alter table public.safe_walk_alerts enable row level security;

-- ---------------------------------------------------------------------
-- Optional: anonymous, aggregate-only usage counters.
-- No user identifiers, no locations, no route history.
-- ---------------------------------------------------------------------
create table if not exists public.anonymous_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  created_at timestamptz not null default now()
);

alter table public.anonymous_events enable row level security;

drop policy if exists "anyone may record an anonymous event" on public.anonymous_events;
create policy "anyone may record an anonymous event"
  on public.anonymous_events
  for insert
  to anon, authenticated
  with check (true);
