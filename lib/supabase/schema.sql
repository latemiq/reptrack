-- RepTrack — pełny schemat bazy.
-- Skrypt jest idempotentny: można go uruchamiać wielokrotnie w Supabase SQL Editor
-- (również na istniejącej bazie — dociąga brakujące tabele, kolumny i polityki).
--
-- User IDs to Clerk IDs (text). API korzysta z service-role key, więc RLS chroni
-- tylko przed bezpośrednim dostępem z kluczem anon.

create extension if not exists "pgcrypto";

-- ─── PROFILES ────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id text primary key,
  created_at timestamptz default now()
);

alter table profiles add column if not exists email        text;
alter table profiles add column if not exists username     text;
alter table profiles add column if not exists first_name   text;
alter table profiles add column if not exists last_name    text;
alter table profiles add column if not exists image_url    text;
alter table profiles add column if not exists age          int;
alter table profiles add column if not exists weight_kg    decimal;
alter table profiles add column if not exists height_cm    int;
alter table profiles add column if not exists location     text;
alter table profiles add column if not exists level        text;
alter table profiles add column if not exists bio          text;
alter table profiles add column if not exists weekly_days  int;
alter table profiles add column if not exists weekly_km_goal decimal;
alter table profiles add column if not exists onboarded_at timestamptz;
alter table profiles add column if not exists updated_at   timestamptz default now();
-- 'athlete' loguje treningi; 'trainer' dodatkowo ma panel /trainer z podopiecznymi.
alter table profiles add column if not exists role         text not null default 'athlete';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('athlete', 'trainer'));

alter table profiles enable row level security;
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles
  for select using ((auth.jwt() ->> 'sub') = id);
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using ((auth.jwt() ->> 'sub') = id)
  with check ((auth.jwt() ->> 'sub') = id);

-- ─── WEIGHT LOGS ─────────────────────────────────────────────────────────────

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  weight_kg decimal not null,
  logged_at timestamptz default now()
);

create index if not exists weight_logs_user_logged_at_idx
  on weight_logs (user_id, logged_at desc);

alter table weight_logs enable row level security;
drop policy if exists "Users can manage own weight logs" on weight_logs;
create policy "Users can manage own weight logs" on weight_logs
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- ─── EXERCISES ───────────────────────────────────────────────────────────────
-- Wiersze katalogowe są globalne, własne należą do użytkownika Clerk.

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
drop policy if exists "Users can view catalog and own exercises" on exercises;
create policy "Users can view catalog and own exercises" on exercises
  for select using (source = 'catalog' or (auth.jwt() ->> 'sub') = user_id);
drop policy if exists "Users can manage own exercises" on exercises;
create policy "Users can manage own exercises" on exercises
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- ─── WORKOUT TEMPLATES ───────────────────────────────────────────────────────
-- exercises: [{ exerciseId, name, targetSets, targetReps, targetWeight, restSeconds }]

create table if not exists workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  exercises jsonb not null default '[]',
  last_used_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists workout_templates_user_idx on workout_templates (user_id, created_at);

alter table workout_templates enable row level security;
drop policy if exists "Users can manage own templates" on workout_templates;
create policy "Users can manage own templates" on workout_templates
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- ─── WORKOUTS ────────────────────────────────────────────────────────────────

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
drop policy if exists "Users can manage own workouts" on workouts;
create policy "Users can manage own workouts" on workouts
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- exercise_id jest tekstem, bo szablony mogą używać lokalnych ID
-- zanim ćwiczenie zostanie powiązane z UUID w Supabase.
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

alter table workout_sets add column if not exists exercise_name text;

create index if not exists workout_sets_workout_position_idx
  on workout_sets (workout_id, exercise_position, set_number);

alter table workout_sets enable row level security;
drop policy if exists "Users can manage own workout sets" on workout_sets;
create policy "Users can manage own workout sets" on workout_sets
  for all using (
    (auth.jwt() ->> 'sub') = (select user_id from workouts where workouts.id = workout_id)
  )
  with check (
    (auth.jwt() ->> 'sub') = (select user_id from workouts where workouts.id = workout_id)
  );

-- ─── RUNS ────────────────────────────────────────────────────────────────────

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
drop policy if exists "Users can manage own runs" on runs;
create policy "Users can manage own runs" on runs
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- ─── GOALS ───────────────────────────────────────────────────────────────────

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

alter table goals add column if not exists completed_at timestamptz;
alter table goals add column if not exists updated_at timestamptz default now();

create index if not exists goals_user_status_idx on goals (user_id, status);

alter table goals enable row level security;
drop policy if exists "Users can manage own goals" on goals;
create policy "Users can manage own goals" on goals
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- ─── AI COACH ────────────────────────────────────────────────────────────────

create table if not exists coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  category text not null default 'gym',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists coach_conversations_user_updated_idx
  on coach_conversations (user_id, updated_at desc);

alter table coach_conversations enable row level security;
drop policy if exists "Users can manage own conversations" on coach_conversations;
create policy "Users can manage own conversations" on coach_conversations
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create table if not exists coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references coach_conversations(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists coach_messages_conversation_idx
  on coach_messages (conversation_id, created_at);

alter table coach_messages enable row level security;
drop policy if exists "Users can manage own messages" on coach_messages;
create policy "Users can manage own messages" on coach_messages
  for all using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

-- ─── TRAINER ↔ CLIENTS ───────────────────────────────────────────────────────
-- Trener tworzy zaproszenie (status 'pending', client_id null, invite_code).
-- Podopieczny wpisuje kod → client_id ustawione, status 'active'.
-- Zakończenie współpracy przez którąkolwiek stronę → status 'ended'.

create table if not exists coach_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id text not null,
  client_id text,
  invite_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'ended')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now(),
  accepted_at timestamptz,
  ended_at timestamptz
);

create index if not exists coach_clients_trainer_idx on coach_clients (trainer_id, status);
create index if not exists coach_clients_client_idx  on coach_clients (client_id, status);
create unique index if not exists coach_clients_active_pair_idx
  on coach_clients (trainer_id, client_id) where status = 'active';

alter table coach_clients enable row level security;
drop policy if exists "Trainer and client can view relation" on coach_clients;
create policy "Trainer and client can view relation" on coach_clients
  for select using ((auth.jwt() ->> 'sub') in (trainer_id, client_id));

-- ─── STORAGE (opcjonalnie) ───────────────────────────────────────────────────
-- insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false);
