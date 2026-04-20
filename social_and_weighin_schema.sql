-- MoveMinder Phase 2: Social Layer + Weigh-Ins
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ─────────────────────────────────────────────
-- 1. weigh_ins
-- ─────────────────────────────────────────────
create table if not exists public.weigh_ins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  weight_kg     numeric(6,2) not null check (weight_kg > 0),
  logged_date   date not null default current_date,
  notes         text,
  share_weight  boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, logged_date)
);

alter table public.weigh_ins enable row level security;

create policy "Users manage their own weigh-ins"
  on public.weigh_ins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. friendships
-- ─────────────────────────────────────────────
create table if not exists public.friendships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  friend_id   uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friendships enable row level security;

create policy "Users can see their own friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can create friendship requests"
  on public.friendships for insert
  with check (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can update friendships they are part of"
  on public.friendships for update
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can delete friendships they are part of"
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- ─────────────────────────────────────────────
-- 3. friend_invites
-- ─────────────────────────────────────────────
create table if not exists public.friend_invites (
  id              uuid primary key default gen_random_uuid(),
  inviter_id      uuid not null references auth.users(id) on delete cascade,
  token           text not null unique,
  uses_remaining  integer not null default 10,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.friend_invites enable row level security;

-- Anyone can read an invite by token (needed for unauthenticated invite pages)
create policy "Anyone can read invites"
  on public.friend_invites for select
  using (true);

create policy "Owners can create invites"
  on public.friend_invites for insert
  with check (auth.uid() = inviter_id);

create policy "Owners can update invites"
  on public.friend_invites for update
  using (auth.uid() = inviter_id);

-- Helper function to decrement uses_remaining safely
create or replace function public.decrement_invite_uses(invite_id uuid)
returns void
language plpgsql security definer
as $$
begin
  update public.friend_invites
  set uses_remaining = greatest(uses_remaining - 1, 0)
  where id = invite_id;
end;
$$;

-- ─────────────────────────────────────────────
-- 4. session_reactions
-- ─────────────────────────────────────────────
create table if not exists public.session_reactions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.workout_sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (session_id, user_id, emoji)
);

alter table public.session_reactions enable row level security;

create policy "Anyone can read reactions"
  on public.session_reactions for select
  using (true);

create policy "Users manage their own reactions"
  on public.session_reactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 5. reminder_preferences  (auto-created on signup via trigger)
-- ─────────────────────────────────────────────
create table if not exists public.reminder_preferences (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  morning_reminder    boolean not null default true,
  reminder_hour       integer not null default 8 check (reminder_hour between 0 and 23),
  created_at          timestamptz not null default now()
);

alter table public.reminder_preferences enable row level security;

create policy "Users manage their own reminder preferences"
  on public.reminder_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create reminder_preferences row on signup
create or replace function public.handle_new_user_preferences()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.reminder_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_preferences on auth.users;
create trigger on_auth_user_created_preferences
  after insert on auth.users
  for each row execute procedure public.handle_new_user_preferences();

-- ─────────────────────────────────────────────
-- 6. friend_weigh_ins  (VIEW — masks weight unless share_weight = true)
-- ─────────────────────────────────────────────
create or replace view public.friend_weigh_ins as
select
  w.id,
  w.user_id,
  w.logged_date,
  w.created_at,
  case when w.share_weight then w.weight_kg else null end as weight_kg,
  w.share_weight
from public.weigh_ins w;

-- RLS on the underlying weigh_ins table controls access.
-- Grant select on the view to authenticated users:
grant select on public.friend_weigh_ins to authenticated;
