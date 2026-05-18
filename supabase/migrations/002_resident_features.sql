-- Add preferred_slot to complaints
alter table public.complaints add column if not exists preferred_slot text;

-- Create upvotes table for community board
create table if not exists public.complaint_upvotes (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(complaint_id, user_id)
);

-- RLS for complaint_upvotes
alter table public.complaint_upvotes enable row level security;

create policy "complaint_upvotes: users can select within society"
  on public.complaint_upvotes for select
  using (
    exists (
      select 1 from public.complaints c
      where c.id = public.complaint_upvotes.complaint_id
    )
  );

create policy "complaint_upvotes: users can insert their own upvote"
  on public.complaint_upvotes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.complaints c
      where c.id = complaint_id
    )
  );

create policy "complaint_upvotes: users can delete their own upvote"
  on public.complaint_upvotes for delete
  using (user_id = auth.uid());

-- Update RLS for complaints to allow residents to see 'community' type complaints in their society
drop policy if exists "complaints: residents can select own" on public.complaints;

create policy "complaints: residents can select own or community"
  on public.complaints for select
  using (
    (
      -- their own complaints
      submitted_by = auth.uid()
      and exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.role = 'resident'
      )
    )
    or
    (
      -- community complaints in their society
      type = 'community'
      and society_id = (select society_id from public.users where id = auth.uid())
      and exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.role = 'resident'
      )
    )
  );

-- Create Storage bucket for attachments if not exists
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "Attachments: public can read"
  on storage.objects for select
  using ( bucket_id = 'attachments' );

create policy "Attachments: authenticated users can insert"
  on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and auth.role() = 'authenticated'
  );
