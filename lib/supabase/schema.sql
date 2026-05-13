-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Profiles use Clerk IDs directly because API routes authenticate with Clerk.
-- Service-role API calls do not require a profile row to exist before first insert.
create table if not exists profiles (
  id text primary key,
  email text,
  username text,
  weight_kg decimal,
  height_cm int,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles
  for select using ((auth.jwt() ->> 'sub') = id);
create policy "Users can update own profile" on profiles
  for update using ((auth.jwt() ->> 'sub') = id)
  with check ((auth.jwt() ->> 'sub') = id);

-- Weight logs
create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  weight_kg decimal not null,
  logged_at timestamptz default now()
);

create index if not exists weight_logs_user_logged_at_idx
  on weight_logs (user_id, logged_at desc);

alter table weight_logs enable row level security;
create policy "Users can manage own weight logs" on weight_logs
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- Exercise library: catalog rows are global, custom rows belong to a Clerk user.
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  catalog_id text unique,
  source text not null default 'custom' check (source in ('catalog', 'custom')),
  name text not null,
  muscle_group text,
  equipment text,
  force text,
  level text,
  mechanic text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions text[] not null default '{}',
  category text,
  images text[] not null default '{}',
  is_custom boolean default true,
  created_at timestamptz default now()
);

create index if not exists exercises_source_name_idx on exercises (source, name);
create index if not exists exercises_user_name_idx on exercises (user_id, name);

alter table exercises enable row level security;
create policy "Users can view catalog and own exercises" on exercises
  for select using (source = 'catalog' or (auth.jwt() ->> 'sub') = user_id);
create policy "Users can manage own exercises" on exercises
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- Workouts
create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  template_id text,
  name text not null,
  notes text,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_seconds int,
  total_tonnage decimal default 0,
  created_at timestamptz default now()
);

create index if not exists workouts_user_started_at_idx
  on workouts (user_id, started_at desc);

alter table workouts enable row level security;
create policy "Users can manage own workouts" on workouts
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- Workout sets. exercise_id is text because templates may use stable local IDs
-- before an exercise is linked to a Supabase UUID.
create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id text not null,
  exercise_position int not null default 0,
  set_number int not null,
  reps int,
  weight_kg decimal,
  rpe decimal,
  logged_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists workout_sets_workout_position_idx
  on workout_sets (workout_id, exercise_position, set_number);

alter table workout_sets enable row level security;
create policy "Users can manage own workout sets" on workout_sets
  for all using (
    (auth.jwt() ->> 'sub') = (select user_id from workouts where workouts.id = workout_id)
  )
  with check (
    (auth.jwt() ->> 'sub') = (select user_id from workouts where workouts.id = workout_id)
  );

-- Runs
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  distance_km decimal not null,
  duration_seconds int not null,
  avg_pace_seconds_per_km int,
  avg_hr int,
  max_hr int,
  elevation_gain_m decimal,
  calories int,
  location text,
  type text default 'easy',
  source text default 'manual',
  raw_screenshot_url text,
  notes text,
  ran_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists runs_user_ran_at_idx on runs (user_id, ran_at desc);

alter table runs enable row level security;
create policy "Users can manage own runs" on runs
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- Goals
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  category text,
  type text not null,
  exercise_id text,
  unit text,
  target_value decimal not null,
  start_value decimal not null,
  current_value decimal,
  target_date date,
  status text default 'active',
  created_at timestamptz default now()
);

create index if not exists goals_user_status_idx on goals (user_id, status);

alter table goals enable row level security;
create policy "Users can manage own goals" on goals
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- Storage bucket for screenshots (run in Supabase dashboard if needed)
-- insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false);
-- create policy "Users can upload own screenshots" on storage.objects
--   for insert with check ((auth.jwt() ->> 'sub') = (storage.foldername(name))[1]);
-- create policy "Users can view own screenshots" on storage.objects
--   for select using ((auth.jwt() ->> 'sub') = (storage.foldername(name))[1]);
