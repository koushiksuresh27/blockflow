-- ============================================================
-- BlockFlow — Apartment Maintenance Platform
-- Migration: 001_init.sql
-- Created: 2026-05-17
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. SOCIETIES
-- ============================================================
create table public.societies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text not null,
  city        text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2. TOWERS
-- ============================================================
create table public.towers (
  id          uuid primary key default gen_random_uuid(),
  society_id  uuid not null references public.societies (id) on delete cascade,
  name        text not null,
  floor_count int  not null check (floor_count > 0)
);

-- ============================================================
-- 3. APARTMENTS
-- ============================================================
create table public.apartments (
  id            uuid primary key default gen_random_uuid(),
  tower_id      uuid not null references public.towers (id) on delete cascade,
  floor_number  int  not null,
  flat_number   text not null
);

-- ============================================================
-- 4. USERS  (extends auth.users)
-- ============================================================
create table public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null,
  phone        text,
  role         text not null check (role in ('resident', 'technician', 'admin', 'super_admin')),
  society_id   uuid references public.societies (id) on delete set null,
  apartment_id uuid references public.apartments (id) on delete set null
);

-- ============================================================
-- 5. TECHNICIANS
-- ============================================================
create table public.technicians (
  id                uuid    primary key default gen_random_uuid(),
  user_id           uuid    not null unique references public.users (id) on delete cascade,
  society_id        uuid    not null references public.societies (id) on delete cascade,
  specializations   text[]  not null default '{}',
  performance_score numeric not null default 0,
  is_available      boolean not null default true
);

-- ============================================================
-- 6. COMPLAINTS
-- ============================================================
create table public.complaints (
  id               uuid        primary key default gen_random_uuid(),
  society_id       uuid        not null references public.societies (id) on delete cascade,
  submitted_by     uuid        not null references public.users (id) on delete restrict,
  type             text        not null check (type in ('personal', 'community', 'emergency')),
  category         text        not null,
  priority         text        not null check (priority in ('low', 'medium', 'high', 'critical')),
  status           text        not null default 'open'
                               check (status in (
                                 'open', 'triaged', 'assigned', 'accepted',
                                 'in_progress', 'on_hold', 'resolved',
                                 'verified', 'closed', 'escalated', 'reopened'
                               )),
  title            text        not null,
  description      text        not null,
  location_apt_id  uuid        references public.apartments (id) on delete set null,
  assigned_tech_id uuid        references public.technicians (id) on delete set null,
  sla_deadline     timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger complaints_set_updated_at
  before update on public.complaints
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 7. COMPLAINT ATTACHMENTS
-- ============================================================
create table public.complaint_attachments (
  id              uuid primary key default gen_random_uuid(),
  complaint_id    uuid not null references public.complaints (id) on delete cascade,
  url             text not null,
  attachment_type text not null check (attachment_type in ('before', 'after', 'general')),
  uploaded_by     uuid not null references public.users (id) on delete restrict,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 8. COMPLAINT LOGS  (append-only audit trail)
-- ============================================================
create table public.complaint_logs (
  id           uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  actor_id     uuid not null references public.users (id) on delete restrict,
  action       text not null,
  old_status   text,
  new_status   text,
  note         text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- 9. RATINGS
-- ============================================================
create table public.ratings (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid unique not null references public.complaints (id) on delete cascade,
  rated_by      uuid not null references public.users (id) on delete restrict,
  technician_id uuid not null references public.technicians (id) on delete restrict,
  score         int  not null check (score between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- INDEXES  (commonly queried FK / filter columns)
-- ============================================================
create index on public.towers           (society_id);
create index on public.apartments       (tower_id);
create index on public.users            (society_id);
create index on public.technicians      (society_id);
create index on public.complaints       (society_id);
create index on public.complaints       (submitted_by);
create index on public.complaints       (assigned_tech_id);
create index on public.complaints       (status);
create index on public.complaint_attachments (complaint_id);
create index on public.complaint_logs   (complaint_id);
create index on public.ratings          (technician_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper: get the current user's public.users row efficiently
create or replace function public.current_user_row()
returns public.users
language sql
stable
security definer
as $$
  select * from public.users where id = auth.uid() limit 1;
$$;

-- ============================================================
-- RLS — societies (read-only; managed by super_admin via service role)
-- ============================================================
alter table public.societies enable row level security;

create policy "societies: authenticated users can read their own society"
  on public.societies for select
  using (
    id = (select society_id from public.users where id = auth.uid())
  );

-- ============================================================
-- RLS — towers
-- ============================================================
alter table public.towers enable row level security;

create policy "towers: readable within same society"
  on public.towers for select
  using (
    society_id = (select society_id from public.users where id = auth.uid())
  );

-- ============================================================
-- RLS — apartments
-- ============================================================
alter table public.apartments enable row level security;

create policy "apartments: readable within same society via tower"
  on public.apartments for select
  using (
    tower_id in (
      select id from public.towers
      where society_id = (select society_id from public.users where id = auth.uid())
    )
  );

-- ============================================================
-- RLS — users (profile data)
-- ============================================================
alter table public.users enable row level security;

create policy "users: users can read own profile"
  on public.users for select
  using (id = auth.uid());

create policy "users: users can update own profile"
  on public.users for update
  using (id = auth.uid());

create policy "users: admins can read all users in their society"
  on public.users for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'super_admin')
        and u.society_id = public.users.society_id
    )
  );

-- ============================================================
-- RLS — technicians
-- ============================================================
alter table public.technicians enable row level security;

create policy "technicians: readable within same society"
  on public.technicians for select
  using (
    society_id = (select society_id from public.users where id = auth.uid())
  );

-- ============================================================
-- RLS — complaints
-- ============================================================
alter table public.complaints enable row level security;

-- Residents: SELECT own complaints
create policy "complaints: residents can select own"
  on public.complaints for select
  using (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'resident'
    )
  );

-- Residents: INSERT own complaints (society_id must match theirs)
create policy "complaints: residents can insert own"
  on public.complaints for insert
  with check (
    submitted_by = auth.uid()
    and society_id = (select society_id from public.users where id = auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'resident'
    )
  );

-- Technicians: SELECT complaints assigned to them
create policy "complaints: technicians can select assigned"
  on public.complaints for select
  using (
    exists (
      select 1
      from public.technicians t
      where t.user_id = auth.uid()
        and t.id = public.complaints.assigned_tech_id
    )
  );

-- Admins: SELECT all complaints in their society
create policy "complaints: admins can select society complaints"
  on public.complaints for select
  using (
    society_id = (select society_id from public.users where id = auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  );

-- Admins: UPDATE all complaints in their society
create policy "complaints: admins can update society complaints"
  on public.complaints for update
  using (
    society_id = (select society_id from public.users where id = auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  );

-- ============================================================
-- RLS — complaint_attachments
-- ============================================================
alter table public.complaint_attachments enable row level security;

-- Anyone who can SELECT the parent complaint can SELECT its attachments
create policy "attachments: select if complaint is accessible"
  on public.complaint_attachments for select
  using (
    complaint_id in (select id from public.complaints)
  );

-- Uploaders can insert attachments for complaints they can see
create policy "attachments: insert if complaint is accessible"
  on public.complaint_attachments for insert
  with check (
    uploaded_by = auth.uid()
    and complaint_id in (select id from public.complaints)
  );

-- ============================================================
-- RLS — complaint_logs  (INSERT only; NO UPDATE / DELETE for anyone)
-- ============================================================
alter table public.complaint_logs enable row level security;

-- Any authenticated user who can view the complaint can INSERT a log entry
create policy "complaint_logs: insert only for authenticated users"
  on public.complaint_logs for insert
  with check (
    actor_id = auth.uid()
    and complaint_id in (select id from public.complaints)
  );

-- Admins can read logs for complaints in their society
create policy "complaint_logs: admins can select logs in their society"
  on public.complaint_logs for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
    and complaint_id in (
      select id from public.complaints
    )
  );

-- Explicitly NO update/delete policies created → blocked by default under RLS

-- ============================================================
-- RLS — ratings
-- ============================================================
alter table public.ratings enable row level security;

create policy "ratings: residents can insert their own rating"
  on public.ratings for insert
  with check (
    rated_by = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'resident'
    )
  );

create policy "ratings: users can read ratings in their society"
  on public.ratings for select
  using (
    complaint_id in (select id from public.complaints)
  );

-- ============================================================
-- END OF MIGRATION
-- ============================================================
