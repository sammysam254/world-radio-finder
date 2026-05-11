create table if not exists station_ratings (
  id uuid primary key default gen_random_uuid(),
  station_id text not null,
  station_name text not null,
  vote text not null check (vote in ('up','down')),
  created_at timestamptz default now()
);
create index if not exists idx_station_ratings_id on station_ratings(station_id);
