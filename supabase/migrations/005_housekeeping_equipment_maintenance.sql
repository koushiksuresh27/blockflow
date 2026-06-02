-- 005_housekeeping_equipment_maintenance.sql

create table public.housekeeping_staff (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references public.societies(id) on delete cascade,
  name text not null,
  phone text,
  assigned_area text,
  shift text check (shift in ('morning','evening','night')),
  status text default 'off_duty' check (status in ('on_duty','off_duty')),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.housekeeping_staff enable row level security;

-- Policies for housekeeping_staff
create policy "Admins can manage housekeeping_staff"
  on public.housekeeping_staff
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.society_id = housekeeping_staff.society_id
      and u.role = 'admin'
    )
  );

create table public.housekeeping_tasks (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references public.societies(id) on delete cascade,
  staff_id uuid references public.housekeeping_staff(id) on delete set null,
  task_name text not null,
  area text,
  frequency text check (frequency in ('daily','weekly','monthly')),
  last_completed timestamptz,
  next_due timestamptz,
  status text default 'pending' check (status in ('pending','completed','overdue')),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.housekeeping_tasks enable row level security;

-- Policies for housekeeping_tasks
create policy "Admins can manage housekeeping_tasks"
  on public.housekeeping_tasks
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.society_id = housekeeping_tasks.society_id
      and u.role = 'admin'
    )
  );

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references public.societies(id) on delete cascade,
  name text not null,
  location text,
  status text default 'operational' check (status in ('operational','needs_attention','critical')),
  last_inspected timestamptz,
  next_inspection timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.equipment enable row level security;

-- Policies for equipment
create policy "Admins can manage equipment"
  on public.equipment
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.society_id = equipment.society_id
      and u.role = 'admin'
    )
  );

create table public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references public.societies(id) on delete cascade,
  task_name text not null,
  category text,
  equipment_id uuid references public.equipment(id) on delete set null,
  assigned_tech_id uuid references public.technicians(id) on delete set null,
  frequency text check (frequency in ('one_time','weekly','monthly','quarterly','annually')),
  last_completed timestamptz,
  next_due timestamptz not null,
  status text default 'upcoming' check (status in ('upcoming','due_soon','overdue','completed')),
  notes text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.maintenance_schedules enable row level security;

-- Policies for maintenance_schedules
create policy "Admins can manage maintenance_schedules"
  on public.maintenance_schedules
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.society_id = maintenance_schedules.society_id
      and u.role = 'admin'
    )
  );
