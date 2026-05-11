create table if not exists station_plays (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  station_id text not null,
  station_name text not null,
  station_type text not null default 'radio',
  play_count int not null default 1,
  last_played timestamptz default now(),
  created_at timestamptz default now(),
  unique(device_id, station_id)
);
create index if not exists idx_station_plays_device on station_plays(device_id);
create index if not exists idx_station_plays_station on station_plays(station_id);
