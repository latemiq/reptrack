// Demo data for the trainer panel: 4 fake clients with ~6 weeks of workouts
// and a running macrocycle for one of them, all linked to a trainer account.
//
//   npm run seed:trainer                          → trainer = dev_user (NEXT_PUBLIC_BYPASS_AUTH=true)
//   npm run seed:trainer -- --trainer=ja@mail.pl  → trainer = your Clerk account (log in once first)
//   npm run seed:trainer -- --clean               → remove demo data only
//
// Idempotent: previous demo data (profiles/workouts with id prefix "seed_client_") is
// replaced on every run. Demo clients are not Clerk users, so they cannot log in.

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { emptyMesocycle, newId, toISODate, type Macrocycle, type PlannedExercise } from '../lib/plans'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const PREFIX = 'seed_client_'
const WEEKS = 6

const args = process.argv.slice(2)
const trainerArg = args.find(a => a.startsWith('--trainer='))?.split('=')[1] ?? 'dev_user'
const cleanOnly = args.includes('--clean')

// Deterministic RNG so every run produces the same-looking history.
let seed = 42
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const pick = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
const round25 = (kg: number) => Math.round(kg / 2.5) * 2.5

// ─── Clients ────────────────────────────────────────────────────────────────

interface Lift { id: string; name: string; sets: number; reps: number; kg: number; incPerWeek: number }
interface Session { name: string; day: number; lifts: Lift[] } // day: 1 = Monday

const L = (id: string, name: string, sets: number, reps: number, kg: number, incPerWeek = 0): Lift =>
  ({ id, name, sets, reps, kg, incPerWeek })

const PUSH = (k: number): Session['lifts'] => [
  L('bench',    'Wyciskanie sztangi na ławce',   4, 8,  60 * k, 2.5),
  L('incline',  'Wyciskanie hantli skos góra',   3, 10, 22 * k, 1),
  L('ohp',      'OHP — wyciskanie żołnierskie',  3, 8,  37.5 * k, 1.25),
  L('pushdown', 'Prostowanie ramion na wyciągu', 3, 12, 25 * k),
]
const PULL = (k: number): Session['lifts'] => [
  L('deadlift', 'Martwy ciąg',                   3, 5,  100 * k, 5),
  L('pullup',   'Podciąganie na drążku',         4, 8,  0),
  L('row',      'Wiosłowanie sztangą',           3, 10, 55 * k, 2.5),
  L('curl',     'Uginanie ramion ze sztangą',    3, 12, 25 * k),
]
const LEGS = (k: number): Session['lifts'] => [
  L('squat',    'Przysiad ze sztangą',           4, 6,  80 * k, 2.5),
  L('rdl',      'Rumuński martwy ciąg',          3, 8,  70 * k, 2.5),
  L('legpress', 'Wypychanie na suwnicy',         3, 12, 140 * k, 5),
  L('calf',     'Wspięcia na palce',             4, 15, 60 * k),
]

interface DemoClient {
  key: string
  first: string
  last: string
  age: number
  weightKg: number
  heightCm: number
  level: 'beginner' | 'intermediate' | 'advanced'
  sessions: Session[]
  skipChance: number
  /** Stopped training this many days ago (shows the "7+ days" warning). */
  stoppedDaysAgo?: number
  hasPlan?: boolean
}

const CLIENTS: DemoClient[] = [
  {
    key: 'anna', first: 'Anna', last: 'Kowalska', age: 28, weightKg: 62, heightCm: 168, level: 'intermediate',
    sessions: [{ name: 'Push', day: 1, lifts: PUSH(0.6) }, { name: 'Pull', day: 3, lifts: PULL(0.65) }, { name: 'Legs', day: 5, lifts: LEGS(0.8) }],
    skipChance: 0.05, hasPlan: true,
  },
  {
    key: 'marek', first: 'Marek', last: 'Nowak', age: 34, weightKg: 88, heightCm: 182, level: 'beginner',
    sessions: [
      { name: 'FBW A', day: 1, lifts: [L('squat', 'Przysiad ze sztangą', 3, 8, 60, 2.5), L('bench', 'Wyciskanie sztangi na ławce', 3, 8, 55, 2.5), L('row', 'Wiosłowanie sztangą', 3, 10, 45, 2.5)] },
      { name: 'FBW B', day: 4, lifts: [L('deadlift', 'Martwy ciąg', 3, 5, 80, 5), L('ohp', 'OHP — wyciskanie żołnierskie', 3, 8, 32.5, 1.25), L('pullup', 'Podciąganie na drążku', 3, 5, 0)] },
    ],
    skipChance: 0.15,
  },
  {
    key: 'kasia', first: 'Katarzyna', last: 'Wiśniewska', age: 31, weightKg: 70, heightCm: 172, level: 'advanced',
    sessions: [
      { name: 'Siła — przysiad', day: 1, lifts: [L('squat', 'Przysiad ze sztangą', 5, 3, 110, 2.5), L('rdl', 'Rumuński martwy ciąg', 3, 6, 90, 2.5)] },
      { name: 'Siła — wyciskanie', day: 2, lifts: [L('bench', 'Wyciskanie sztangi na ławce', 5, 3, 72.5, 1.25), L('ohp', 'OHP — wyciskanie żołnierskie', 4, 5, 45, 1.25)] },
      { name: 'Siła — martwy', day: 4, lifts: [L('deadlift', 'Martwy ciąg', 5, 2, 140, 2.5), L('row', 'Wiosłowanie sztangą', 4, 6, 65, 2.5)] },
      { name: 'Akcesoria', day: 6, lifts: [L('pullup', 'Podciąganie na drążku', 4, 6, 0), L('lunge', 'Wykroki z hantlami', 3, 10, 20), L('facepull', 'Face pull', 3, 15, 20)] },
    ],
    skipChance: 0.05,
  },
  {
    key: 'tomek', first: 'Tomasz', last: 'Zieliński', age: 24, weightKg: 79, heightCm: 178, level: 'intermediate',
    sessions: [{ name: 'Push', day: 1, lifts: PUSH(1) }, { name: 'Pull', day: 3, lifts: PULL(1) }, { name: 'Legs', day: 5, lifts: LEGS(1) }],
    skipChance: 0.2, stoppedDaysAgo: 12,
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

const startOfWeek = (weeksAgo: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - weeksAgo * 7) // Monday
  return d
}

async function must<T>(label: string, p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) {
    console.error(`✗ ${label}:`, error)
    process.exit(1)
  }
  return data
}

async function resolveTrainer(): Promise<string> {
  if (!trainerArg.includes('@')) {
    await must('profil trenera', supabase.from('profiles').upsert({ id: trainerArg }, { onConflict: 'id', ignoreDuplicates: true }))
    return trainerArg
  }
  const { data } = await supabase.from('profiles').select('id').ilike('email', trainerArg).maybeSingle()
  if (!data) {
    console.error(`✗ Nie znaleziono profilu z emailem ${trainerArg}. Zaloguj się nim raz w aplikacji i uruchom skrypt ponownie.`)
    process.exit(1)
  }
  return data.id
}

async function clean() {
  await must('usuwanie planów', supabase.from('macrocycles').delete().like('client_id', `${PREFIX}%`))
  await must('usuwanie relacji', supabase.from('coach_clients').delete().like('client_id', `${PREFIX}%`))
  await must('usuwanie treningów', supabase.from('workouts').delete().like('user_id', `${PREFIX}%`))
  await must('usuwanie wagi', supabase.from('weight_logs').delete().like('user_id', `${PREFIX}%`))
  await must('usuwanie profili', supabase.from('profiles').delete().like('id', `${PREFIX}%`))
}

async function seedWorkouts(clientId: string, c: DemoClient) {
  const now = Date.now()
  let count = 0
  for (let w = WEEKS - 1; w >= 0; w--) {
    const monday = startOfWeek(w)
    const weekIdx = WEEKS - 1 - w
    for (const s of c.sessions) {
      const start = new Date(monday)
      start.setDate(start.getDate() + s.day - 1)
      start.setHours(pick(6, 19), pick(0, 3) * 15, 0, 0)
      if (start.getTime() > now - 3600_000) continue
      if (c.stoppedDaysAgo && start.getTime() > now - c.stoppedDaysAgo * 86400_000) continue
      if (rand() < c.skipChance) continue

      const durationSec = pick(45, 80) * 60
      let t = start.getTime() + 5 * 60_000
      let tonnage = 0
      const sets: Record<string, unknown>[] = []
      s.lifts.forEach((lift, pos) => {
        const kg = lift.kg > 0 ? round25(lift.kg + lift.incPerWeek * weekIdx) : null
        for (let n = 1; n <= lift.sets; n++) {
          const reps = Math.max(1, lift.reps + (n === lift.sets ? -pick(0, 2) : pick(-1, 1)))
          t += pick(90, 180) * 1000
          if (kg) tonnage += kg * reps
          sets.push({
            exercise_id: lift.id, exercise_name: lift.name, exercise_position: pos, set_number: n,
            reps, weight_kg: kg, rpe: pick(14, 19) / 2, completed_at: new Date(t).toISOString(),
          })
        }
      })

      const row = await must('trening', supabase.from('workouts').insert({
        user_id: clientId, name: s.name, started_at: start.toISOString(),
        finished_at: new Date(start.getTime() + durationSec * 1000).toISOString(),
        duration_seconds: durationSec, total_tonnage: tonnage,
      }).select('id').single())
      await must('serie', supabase.from('workout_sets').insert(sets.map(x => ({ ...x, workout_id: (row as { id: string }).id }))))
      count++
    }
  }
  return count
}

/** 9-week macrocycle started 3 weeks ago: hypertrophy 4 → strength 4 → deload 1. */
function buildPlan(clientId: string, c: DemoClient): Macrocycle {
  const toPlanned = (l: Lift, kg: number | null, sets: number, repsMin: number, repsMax: number, rpe: number): PlannedExercise => ({
    exerciseId: l.id, name: l.name, sets, repsMin, repsMax, weightKg: kg, percent1rm: null, rpe,
    restSeconds: repsMax <= 6 ? 180 : 120, notes: '',
  })

  const blocks = [
    { name: 'Akumulacja', focus: 'hypertrophy' as const, weeks: 4, reps: [8, 12], rpe: 7.5, kgFactor: 1, setsDelta: 0 },
    { name: 'Intensyfikacja', focus: 'strength' as const, weeks: 4, reps: [4, 6], rpe: 8.5, kgFactor: 1.12, setsDelta: 1 },
    { name: 'Deload', focus: 'deload' as const, weeks: 1, reps: [6, 8], rpe: 6, kgFactor: 0.7, setsDelta: -1 },
  ]

  return {
    id: newId(),
    clientId,
    name: 'Budowa siły — jesień',
    goal: 'Przysiad +10 kg, wyciskanie +5 kg',
    startDate: toISODate(startOfWeek(3)),
    notes: 'Lekki ból lewego barku — przy wyciskaniu nad głowę kontrolować zakres.',
    mesocycles: blocks.map(b => {
      const m = emptyMesocycle(b.name, b.weeks, b.focus)
      m.notes = `Zakres ${b.reps[0]}–${b.reps[1]} powtórzeń, RPE ~${b.rpe}.`
      m.microcycles.forEach((week, wi) => {
        week.sessions = c.sessions.map(s => ({
          id: newId(), dayOfWeek: s.day, name: s.name, notes: '',
          exercises: s.lifts.map(l => toPlanned(
            l,
            l.kg > 0 ? round25(l.kg * b.kgFactor + l.incPerWeek * wi) : null,
            Math.max(2, l.sets + b.setsDelta), b.reps[0], b.reps[1], b.rpe,
          )),
        }))
      })
      return m
    }),
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧹 Usuwam poprzednie dane demo…')
  await clean()
  if (cleanOnly) { console.log('✓ Dane demo usunięte'); return }

  const trainerId = await resolveTrainer()
  await must('rola trenera', supabase.from('profiles').update({ role: 'trainer' }).eq('id', trainerId))
  console.log(`👤 Trener: ${trainerId} (rola: trainer)`)

  for (let i = 0; i < CLIENTS.length; i++) {
    const c = CLIENTS[i]
    const clientId = `${PREFIX}${c.key}`
    const now = new Date().toISOString()
    await must('profil', supabase.from('profiles').insert({
      id: clientId, email: `${c.key}.demo@example.com`, first_name: c.first, last_name: c.last,
      age: c.age, weight_kg: c.weightKg, height_cm: c.heightCm, level: c.level,
      weekly_days: c.sessions.length, role: 'athlete', onboarded_at: now,
    }))
    await must('relacja', supabase.from('coach_clients').insert({
      trainer_id: trainerId, client_id: clientId, invite_code: `DEMO${i + 1}${c.key.slice(0, 2).toUpperCase()}`,
      status: 'active', accepted_at: startOfWeek(WEEKS).toISOString(),
    }))
    const n = await seedWorkouts(clientId, c)

    let planInfo = ''
    if (c.hasPlan) {
      const plan = buildPlan(clientId, c)
      await must('plan', supabase.rpc('save_macrocycle', { p: { ...plan, trainerId } }))
      planInfo = ' + makrocykl 9 tyg.'
    }
    console.log(`  ✓ ${c.first} ${c.last}: ${n} treningów${planInfo}`)
  }

  console.log('\n✓ Gotowe. Otwórz /trainer w aplikacji.')
}

main()
