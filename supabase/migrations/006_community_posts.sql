create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  society_id uuid references public.societies(id),
  posted_by uuid references public.users(id),
  title text not null,
  body text not null,
  category text check (category in (
    'general', 'complaint', 'event', 
    'sale', 'help', 'emergency'
  )) default 'general',
  upvotes int default 0,
  created_at timestamptz default now()
);

create table public.community_post_upvotes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) 
    on delete cascade,
  user_id uuid references public.users(id),
  unique(post_id, user_id)
);

alter table public.community_posts 
  disable row level security;
alter table public.community_post_upvotes 
  disable row level security;
