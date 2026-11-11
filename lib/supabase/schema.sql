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

-- ─── PERIODYZACJA ────────────────────────────────────────────────────────────
-- macrocycles → mesocycles (bloki) → microcycles (tygodnie) → planned_sessions → planned_exercises
-- Plan układa trener dla konkretnego podopiecznego. Tydzień N zaczyna się
-- start_date + 7·(N−1), licząc tygodnie po kolei przez wszystkie mezocykle.
-- Całe drzewo zapisuje funkcja save_macrocycle (jedna transakcja). ID węzłów
-- nadaje klient i są zachowywane między zapisami, więc późniejsze odwołania
-- (np. trening → planned_session_id) pozostają ważne.

create table if not exists macrocycles (
  id uuid primary key default gen_random_uuid(),
  trainer_id text not null,
  client_id text not null,
  name text not null,
  goal text,
  start_date date not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists macrocycles_trainer_client_idx on macrocycles (trainer_id, client_id, start_date desc);
create index if not exists macrocycles_client_idx on macrocycles (client_id, start_date desc);

create table if not exists mesocycles (
  id uuid primary key default gen_random_uuid(),
  macrocycle_id uuid not null references macrocycles(id) on delete cascade,
  position int not null,
  name text not null,
  focus text check (focus in ('hypertrophy', 'strength', 'power', 'endurance', 'deload', 'other')),
  notes text
);

create index if not exists mesocycles_macro_idx on mesocycles (macrocycle_id, position);

create table if not exists microcycles (
  id uuid primary key default gen_random_uuid(),
  mesocycle_id uuid not null references mesocycles(id) on delete cascade,
  position int not null,
  notes text
);

create index if not exists microcycles_meso_idx on microcycles (mesocycle_id, position);

create table if not exists planned_sessions (
  id uuid primary key default gen_random_uuid(),
  microcycle_id uuid not null references microcycles(id) on delete cascade,
  position int not null,
  day_of_week int not null check (day_of_week between 1 and 7), -- 1 = poniedziałek
  name text not null,
  notes text
);

create index if not exists planned_sessions_micro_idx on planned_sessions (microcycle_id, day_of_week, position);

create table if not exists planned_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references planned_sessions(id) on delete cascade,
  position int not null,
  exercise_id text not null,
  exercise_name text not null,
  sets int not null default 3,
  reps_min int,
  reps_max int,
  weight_kg decimal,
  percent_1rm decimal,
  rpe decimal,
  rest_seconds int,
  notes text
);

create index if not exists planned_exercises_session_idx on planned_exercises (session_id, position);

-- Plany są dostępne tylko przez API (service role); RLS blokuje klucz anon.
alter table macrocycles enable row level security;
alter table mesocycles enable row level security;
alter table microcycles enable row level security;
alter table planned_sessions enable row level security;
alter table planned_exercises enable row level security;
drop policy if exists "Trainer and client can view macrocycles" on macrocycles;
create policy "Trainer and client can view macrocycles" on macrocycles
  for select using ((auth.jwt() ->> 'sub') in (trainer_id, client_id));

-- p: { id, trainerId, clientId, name, goal, startDate, notes,
--      mesocycles: [{ id, name, focus, notes,
--        microcycles: [{ id, notes,
--          sessions: [{ id, dayOfWeek, name, notes,
--            exercises: [{ exerciseId, name, sets, repsMin, repsMax, weightKg, percent1rm, rpe, restSeconds, notes }] }] }] }] }
-- Pozycje wynikają z kolejności w tablicach. Uprawnienia sprawdza API;
-- funkcja dodatkowo odmawia nadpisania planu innego trenera/podopiecznego.
create or replace function save_macrocycle(p jsonb) returns uuid
language plpgsql as $$
declare
  macro_id uuid := (p->>'id')::uuid;
  m record;
  w record;
  s record;
begin
  insert into macrocycles (id, trainer_id, client_id, name, goal, start_date, notes, updated_at)
  values (macro_id, p->>'trainerId', p->>'clientId', p->>'name', nullif(p->>'goal', ''),
          (p->>'startDate')::date, nullif(p->>'notes', ''), now())
  on conflict (id) do update
    set name = excluded.name, goal = excluded.goal, start_date = excluded.start_date,
        notes = excluded.notes, updated_at = now()
    where macrocycles.trainer_id = excluded.trainer_id and macrocycles.client_id = excluded.client_id;
  if not found then
    raise exception 'macrocycle % belongs to another trainer or client', macro_id;
  end if;

  delete from mesocycles where macrocycle_id = macro_id;

  for m in select value as v, ordinality as pos
           from jsonb_array_elements(coalesce(p->'mesocycles', '[]')) with ordinality loop
    insert into mesocycles (id, macrocycle_id, position, name, focus, notes)
    values ((m.v->>'id')::uuid, macro_id, m.pos, m.v->>'name', nullif(m.v->>'focus', ''), nullif(m.v->>'notes', ''));

    for w in select value as v, ordinality as pos
             from jsonb_array_elements(coalesce(m.v->'microcycles', '[]')) with ordinality loop
      insert into microcycles (id, mesocycle_id, position, notes)
      values ((w.v->>'id')::uuid, (m.v->>'id')::uuid, w.pos, nullif(w.v->>'notes', ''));

      for s in select value as v, ordinality as pos
               from jsonb_array_elements(coalesce(w.v->'sessions', '[]')) with ordinality loop
        insert into planned_sessions (id, microcycle_id, position, day_of_week, name, notes)
        values ((s.v->>'id')::uuid, (w.v->>'id')::uuid, s.pos, (s.v->>'dayOfWeek')::int,
                s.v->>'name', nullif(s.v->>'notes', ''));

        insert into planned_exercises (session_id, position, exercise_id, exercise_name, sets, reps_min, reps_max,
                                       weight_kg, percent_1rm, rpe, rest_seconds, notes)
        select (s.v->>'id')::uuid, e.ordinality, e.value->>'exerciseId', e.value->>'name',
               (e.value->>'sets')::int, (e.value->>'repsMin')::int, (e.value->>'repsMax')::int,
               (e.value->>'weightKg')::decimal, (e.value->>'percent1rm')::decimal, (e.value->>'rpe')::decimal,
               (e.value->>'restSeconds')::int, nullif(e.value->>'notes', '')
        from jsonb_array_elements(coalesce(s.v->'exercises', '[]')) with ordinality e;
      end loop;
    end loop;
  end loop;

  return macro_id;
end;
$$;

revoke execute on function save_macrocycle(jsonb) from public, anon, authenticated;

-- ─── KOMENTARZE DO TRENINGÓW ─────────────────────────────────────────────────
-- Rozmowa pod wykonanym treningiem: trener (z aktywną relacją) i właściciel treningu.
-- Dostęp sprawdza API (service role); RLS bez polityk blokuje klucz anon.

create table if not exists workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  author_id text not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz default now()
);

create index if not exists workout_comments_workout_idx on workout_comments (workout_id, created_at);
create index if not exists workout_comments_author_idx on workout_comments (author_id, created_at desc);

alter table workout_comments enable row level security;

-- ─── WERYFIKACJA DWUETAPOWA (własna, na darmowym planie Clerk) ───────────────
-- Clerk obsługuje pierwszy etap (email + hasło). Drugi etap — odcisk palca
-- (WebAuthn), aplikacja TOTP lub kod z maila — weryfikuje RepTrack, a wynik
-- zapisuje w podpisanym ciasteczku powiązanym z sesją Clerk (lib/mfa.ts).
-- Tabele dostępne wyłącznie przez API (service role): RLS bez polityk.

create table if not exists mfa_settings (
  user_id text primary key,
  totp_secret text,             -- zaszyfrowany AES-256-GCM (MFA_SECRET)
  totp_enabled boolean not null default false,
  totp_pending_secret text,     -- w trakcie konfiguracji, przed potwierdzeniem kodem
  email_enabled boolean not null default false,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists mfa_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  credential_id text not null unique,   -- base64url
  public_key text not null,             -- base64url (COSE)
  counter bigint not null default 0,
  transports text[] not null default '{}',
  name text,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

create index if not exists mfa_passkeys_user_idx on mfa_passkeys (user_id);

create table if not exists mfa_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists mfa_backup_codes_user_idx on mfa_backup_codes (user_id);

-- Jednorazowe wyzwania: WebAuthn (challenge) i kody z maila (hash kodu).
create table if not exists mfa_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null check (kind in ('passkey_register', 'passkey_auth', 'email_enable', 'email_auth')),
  value text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists mfa_challenges_user_kind_idx on mfa_challenges (user_id, kind, created_at desc);

alter table mfa_settings enable row level security;
alter table mfa_passkeys enable row level security;
alter table mfa_backup_codes enable row level security;
alter table mfa_challenges enable row level security;

-- ─── STORAGE (opcjonalnie) ───────────────────────────────────────────────────
-- insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false);
