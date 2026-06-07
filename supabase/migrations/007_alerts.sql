create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references public.societies(id) on delete cascade,
  sent_by uuid references public.users(id),
  title text not null,
  body text not null,
  type text check (type in ('general', 'emergency', 'maintenance', 'event', 'security')) default 'general',
  created_at timestamptz default now()
);

alter table public.alerts disable row level security;
