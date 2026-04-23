-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Profiles (Clerk → Supabase sync)
create table profiles (
  id uuid primary key,
  clerk_id text unique not null,
  username text,
  weight_kg decimal,
  height_cm int,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Weight logs
create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  weight_kg decimal not null,
  logged_at timestamptz default now()
);

alter table weight_logs enable row level security;
create policy "Users can manage own weight logs" on weight_logs
  for all using (auth.uid() = user_id);

-- Exercise library
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  muscle_group text,
  equipment text,
  is_custom boolean default true,
  created_at timestamptz default now()
);

alter table exercises enable row level security;
create policy "Users can manage own exercises" on exercises
  for all using (auth.uid() = user_id);

-- Workouts
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  notes text,
  started_at timestamptz not null,
  finished_at timestamptz
);

alter table workouts enable row level security;
create policy "Users can manage own workouts" on workouts
  for all using (auth.uid() = user_id);

-- Workout sets
create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references workouts(id) on delete cascade,
  exercise_id uuid references exercises(id),
  set_number int not null,
  reps int,
  weight_kg decimal,
  rpe decimal,
  logged_at timestamptz default now()
);

alter table workout_sets enable row level security;
create policy "Users can manage own workout sets" on workout_sets
  for all using (
    auth.uid() = (select user_id from workouts where id = workout_id)
  );

-- Runs
create table runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  distance_km decimal not null,
  duration_seconds int not null,
  avg_pace_seconds int,
  avg_hr int,
  max_hr int,
  elevation_gain_m decimal,
  calories int,
  source text default 'manual',
  raw_screenshot_url text,
  notes text,
  ran_at timestamptz not null
);

alter table runs enable row level security;
create policy "Users can manage own runs" on runs
  for all using (auth.uid() = user_id);

-- Goals
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  exercise_id uuid references exercises(id),
  target_value decimal not null,
  start_value decimal not null,
  current_value decimal,
  target_date date,
  created_at timestamptz default now()
);

alter table goals enable row level security;
create policy "Users can manage own goals" on goals
  for all using (auth.uid() = user_id);

-- Storage bucket for screenshots (run in dashboard)
-- insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false);
-- create policy "Users can upload own screenshots" on storage.objects
--   for insert with check (auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "Users can view own screenshots" on storage.objects
--   for select using (auth.uid()::text = (storage.foldername(name))[1]);
