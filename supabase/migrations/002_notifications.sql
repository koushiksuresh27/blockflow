-- ============================================================
-- 002_notifications.sql
-- Creates the notifications table for SLA warnings
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_notifications_recipient on public.notifications(recipient_id);
create index idx_notifications_unread on public.notifications(recipient_id) where is_read = false;

-- RLS
alter table public.notifications enable row level security;

create policy "Users can read their own notifications"
  on public.notifications for select
  using (recipient_id = auth.uid());

create policy "Users can update their own notifications"
  on public.notifications for update
  using (recipient_id = auth.uid());

-- Note: Inserting notifications will be handled by the Edge Function
-- which runs with the service_role key, bypassing RLS.
