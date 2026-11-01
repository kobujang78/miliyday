-- Disposable PostgreSQL fixture for the PR #4 points migrations.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role untrusted nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table public.profiles (
  id uuid primary key, email text, display_name text, nickname text,
  nickname_updated_at timestamptz, branch text, rank_level integer default 0,
  enlist_date date, avatar_url text, marketing_agreed boolean default false,
  marketing_agreed_at timestamptz, user_type text default 'soldier',
  relationship text, connected_soldier_id uuid,
  privacy_policy_agreed boolean default false,
  privacy_policy_agreed_at timestamptz, terms_agreed boolean default false,
  points integer not null default 0, invite_code text unique, invited_by uuid
);
create table public.posts (id uuid primary key, user_id uuid references public.profiles(id), board_type text);
create table public.feed_posts (id uuid primary key, user_id uuid references public.profiles(id));
create table public.point_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  amount integer not null, type text not null, description text, reference_id uuid,
  created_at timestamptz default now()
);
create table public.daily_point_limits (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  action_type text not null, action_date date not null, count integer not null default 0
);
create table public.invite_records (
  id uuid primary key default gen_random_uuid(), inviter_id uuid not null references public.profiles(id),
  invitee_id uuid not null references public.profiles(id)
);
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
