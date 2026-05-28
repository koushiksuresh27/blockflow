-- ============================================================
-- BlockFlow — Admin Redesign Migration
-- Migration: 003_admin_redesign.sql
-- Created: 2026-05-28
-- ============================================================

-- ============================================================
-- 1. ADD status COLUMN TO public.users
-- ============================================================
alter table public.users
  add column if not exists status text default 'pending'
  check (status in ('pending', 'active', 'rejected'));

-- Existing admins and technicians should be set to active immediately
-- so they are not blocked by pending checks
update public.users
  set status = 'active'
  where role in ('admin', 'super_admin', 'technician')
    and status = 'pending';

-- ============================================================
-- 2. RLS — Allow admins to update resident status in their society
-- ============================================================

-- Drop if exists to allow re-running idempotently
drop policy if exists "users: admins can update resident status in society" on public.users;

create policy "users: admins can update resident status in society"
  on public.users for update
  using (
    role = 'resident'
    and society_id = (select society_id from public.users where id = auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 3. AUTO-ASSIGN COMPLAINT ON INSERT
-- ============================================================
create or replace function auto_assign_complaint()
returns trigger as $$
declare
  best_tech uuid;
begin
  select t.id into best_tech
  from public.technicians t
  join public.users u on u.id = t.user_id
  where t.society_id = new.society_id
    and t.is_available = true
    and t.specializations && array[new.category]
  order by
    t.performance_score desc,
    (
      select count(*)
      from public.complaints
      where assigned_tech_id = t.id
        and status not in ('closed', 'verified')
    ) asc
  limit 1;

  if best_tech is not null then
    new.assigned_tech_id = best_tech;
    new.status = 'assigned';
  end if;

  return new;
end;
$$ language plpgsql;

-- Drop trigger if exists so migration is idempotent
drop trigger if exists complaint_auto_assign on public.complaints;

create trigger complaint_auto_assign
  before insert on public.complaints
  for each row
  execute function auto_assign_complaint();

-- ============================================================
-- 4. RE-ASSIGN ON TECHNICIAN REJECTION
-- ============================================================
create or replace function reassign_on_rejection()
returns trigger as $$
declare
  best_tech uuid;
begin
  if new.status = 'open'
     and old.status = 'assigned'
     and new.assigned_tech_id is null
  then
    select t.id into best_tech
    from public.technicians t
    join public.users u on u.id = t.user_id
    where t.society_id = new.society_id
      and t.is_available = true
      and t.specializations && array[new.category]
      and t.id != old.assigned_tech_id
    order by t.performance_score desc
    limit 1;

    if best_tech is not null then
      new.assigned_tech_id = best_tech;
      new.status = 'assigned';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

-- Drop trigger if exists
drop trigger if exists complaint_reassign_on_rejection on public.complaints;

create trigger complaint_reassign_on_rejection
  before update on public.complaints
  for each row
  execute function reassign_on_rejection();

-- ============================================================
-- END OF MIGRATION 003
-- ============================================================
