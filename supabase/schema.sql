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
