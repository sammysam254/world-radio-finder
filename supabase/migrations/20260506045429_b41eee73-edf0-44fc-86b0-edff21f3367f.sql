-- Roles enum + table
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- has_role security definer
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Ads
create table public.ads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video_file','video_url','monetag_url')),
  title text not null,
  payload text not null,
  sequence integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ads_sequence_idx on public.ads(sequence);

-- Updated-at trigger fn
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ads_set_updated_at before update on public.ads
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.ads enable row level security;

create policy "Users view own profile" on public.profiles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles for update
  using (auth.uid() = user_id);

create policy "Users view own roles" on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Anyone can view active ads" on public.ads for select
  using (active = true or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage ads" on public.ads for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for ad videos (public read so iframes/<video> can stream)
insert into storage.buckets (id, name, public) values ('ads', 'ads', true)
on conflict (id) do nothing;

create policy "Public read ads bucket" on storage.objects for select
  using (bucket_id = 'ads');
create policy "Admins upload ads" on storage.objects for insert
  with check (bucket_id = 'ads' and public.has_role(auth.uid(), 'admin'));
create policy "Admins update ads" on storage.objects for update
  using (bucket_id = 'ads' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete ads" on storage.objects for delete
  using (bucket_id = 'ads' and public.has_role(auth.uid(), 'admin'));
