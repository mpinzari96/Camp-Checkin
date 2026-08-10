-- ============================================================
-- Camp Check-In — Supabase schema
-- Run this once in the Supabase SQL editor (or `supabase db push`).
-- ============================================================

-- ---------- Roles ----------
create type app_role as enum ('admin', 'volunteer');

-- Volunteer/admin profiles, linked to Supabase Auth users.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        app_role not null default 'volunteer',
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------- Events (future-proofing: multiple camps) ----------
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  starts_on  date,
  ends_on    date,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.events (name, starts_on) values ('Youth for God Camp 2026', '2026-07-20');

-- ---------- Registrants ----------
create table public.registrants (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,

  -- Basic information
  first_name        text not null,
  last_name         text not null,
  preferred_name    text,
  full_name         text generated always as (first_name || ' ' || last_name) stored,
  age               int,
  gender            text check (gender in ('male','female') or gender is null),
  church            text,
  city              text,
  state             text,
  country           text not null default 'USA',
  email             text,
  phone             text,
  merch_size        text,

  -- Camp information
  registration_status text not null default 'registered'
    check (registration_status in ('registered','walk_in','cancelled')),
  cabin             text,          -- future
  small_group       text,          -- future

  -- Liability form (updated by Tally webhook)
  liability_complete     boolean not null default false,
  liability_submitted_at timestamptz,
  liability_payload      jsonb,

  -- Check-in / check-out state (single source of truth)
  checked_in_at     timestamptz,
  checked_in_by     uuid references public.profiles(id),
  checked_out_at    timestamptz,
  checked_out_by    uuid references public.profiles(id),

  -- Emergency information
  emergency_name         text,
  emergency_relationship text,
  emergency_phone        text,
  medical_notes          text,
  allergies              text,
  special_notes          text,
  notes                  text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index registrants_event_idx  on public.registrants (event_id);
create index registrants_name_idx   on public.registrants (lower(first_name), lower(last_name));
create index registrants_email_idx  on public.registrants (lower(email));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger registrants_touch before update on public.registrants
  for each row execute function public.touch_updated_at();

-- ---------- Audit log ----------
create table public.audit_log (
  id            bigint generated always as identity primary key,
  registrant_id uuid references public.registrants(id) on delete set null,
  actor_id      uuid references public.profiles(id),
  action        text not null,   -- check_in | undo_check_in | check_out | undo_check_out | edit | create | delete | liability_webhook
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index audit_registrant_idx on public.audit_log (registrant_id);
create index audit_created_idx    on public.audit_log (created_at desc);

-- ---------- Atomic check-in / check-out RPCs ----------
-- These prevent duplicate check-ins under concurrency: the UPDATE's WHERE
-- clause only matches when the state transition is valid, so two volunteers
-- pressing CHECK IN at once results in exactly one successful transition.

create or replace function public.check_in(reg_id uuid)
returns public.registrants language plpgsql security definer set search_path = public as $$
declare r public.registrants;
begin
  update public.registrants
     set checked_in_at = now(), checked_in_by = auth.uid(),
         checked_out_at = null, checked_out_by = null
   where id = reg_id and checked_in_at is null
   returning * into r;
  if r.id is null then
    raise exception 'ALREADY_CHECKED_IN' using errcode = 'P0001';
  end if;
  insert into audit_log (registrant_id, actor_id, action) values (reg_id, auth.uid(), 'check_in');
  return r;
end $$;

create or replace function public.undo_check_in(reg_id uuid)
returns public.registrants language plpgsql security definer set search_path = public as $$
declare r public.registrants;
begin
  update public.registrants
     set checked_in_at = null, checked_in_by = null
   where id = reg_id and checked_in_at is not null
   returning * into r;
  if r.id is null then
    raise exception 'NOT_CHECKED_IN' using errcode = 'P0001';
  end if;
  insert into audit_log (registrant_id, actor_id, action) values (reg_id, auth.uid(), 'undo_check_in');
  return r;
end $$;

create or replace function public.check_out(reg_id uuid)
returns public.registrants language plpgsql security definer set search_path = public as $$
declare r public.registrants;
begin
  update public.registrants
     set checked_out_at = now(), checked_out_by = auth.uid()
   where id = reg_id and checked_in_at is not null and checked_out_at is null
   returning * into r;
  if r.id is null then
    raise exception 'CANNOT_CHECK_OUT' using errcode = 'P0001';
  end if;
  insert into audit_log (registrant_id, actor_id, action) values (reg_id, auth.uid(), 'check_out');
  return r;
end $$;

create or replace function public.undo_check_out(reg_id uuid)
returns public.registrants language plpgsql security definer set search_path = public as $$
declare r public.registrants;
begin
  update public.registrants
     set checked_out_at = null, checked_out_by = null
   where id = reg_id and checked_out_at is not null
   returning * into r;
  if r.id is null then
    raise exception 'NOT_CHECKED_OUT' using errcode = 'P0001';
  end if;
  insert into audit_log (registrant_id, actor_id, action) values (reg_id, auth.uid(), 'undo_check_out');
  return r;
end $$;

grant execute on function public.check_in(uuid), public.undo_check_in(uuid),
  public.check_out(uuid), public.undo_check_out(uuid) to authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles    enable row level security;
alter table public.events      enable row level security;
alter table public.registrants enable row level security;
alter table public.audit_log   enable row level security;

-- Profiles: users see all profiles (needed to show "checked in by"); only admins change roles.
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles updatable by admin" on public.profiles
  for update to authenticated using (public.current_role() = 'admin');

-- Events: readable by all authenticated; managed by admins.
create policy "events readable" on public.events
  for select to authenticated using (true);
create policy "events managed by admin" on public.events
  for all to authenticated using (public.current_role() = 'admin');

-- Registrants:
--  * everyone authenticated can read
--  * volunteers + admins can INSERT (manual walk-in registration)
--  * volunteers + admins can UPDATE profile fields (check-in state changes go
--    through the RPCs above, which are security definer)
--  * only admins can DELETE
create policy "registrants readable" on public.registrants
  for select to authenticated using (true);
create policy "registrants insertable" on public.registrants
  for insert to authenticated with check (true);
create policy "registrants updatable" on public.registrants
  for update to authenticated using (true);
create policy "registrants deletable by admin" on public.registrants
  for delete to authenticated using (public.current_role() = 'admin');

-- Audit log: readable by admins; written only by security-definer functions / service role.
create policy "audit readable by admin" on public.audit_log
  for select to authenticated using (public.current_role() = 'admin');

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.registrants;
