import type { WarmupItem } from '@/lib/warmup'

export interface TemplateExercise {
  exerciseId: string
  name: string
  targetSets: number
  targetReps: number
  /** Upper end of a rep range ("6–8"); null = a single target. */
  targetRepsMax?: number | null
  targetWeight: number | null
  restSeconds: number
  /** Superset with the previous exercise. */
  superset?: boolean
}

export interface WorkoutTemplate {
  id: string
  name: string
  exercises: TemplateExercise[]
  /** Warm-up loaded into the workout at start (not counted in stats). */
  warmup?: WarmupItem[]
  last_used_at: string | null
  created_at: string
}

const ex = (exerciseId: string, name: string, targetSets: number, targetReps: number, restSeconds: number): TemplateExercise =>
  ({ exerciseId, name, targetSets, targetReps, targetWeight: null, restSeconds })

export const DEFAULT_TEMPLATES: Pick<WorkoutTemplate, 'name' | 'exercises'>[] = [
  {
    name: 'Push · klatka + barki',
    exercises: [
      ex('bench',    'Wyciskanie sztangi na ławce',   4, 6,  180),
      ex('incline',  'Wyciskanie hantli skos góra',   3, 8,  150),
      ex('ohp',      'OHP — wyciskanie żołnierskie',  4, 6,  150),
      ex('dips',     'Pompki na poręczach',           3, 10, 120),
      ex('pushdown', 'Prostowanie ramion na wyciągu', 3, 12, 90),
    ],
  },
  {
    name: 'Pull · plecy + biceps',
    exercises: [
      ex('deadlift', 'Martwy ciąg',                   4, 5,  180),
      ex('pullup',   'Podciąganie na drążku',         4, 8,  150),
      ex('row',      'Wiosłowanie sztangą',           3, 8,  120),
      ex('facepull', 'Face pull',                     3, 15, 90),
      ex('curl',     'Uginanie ramion ze sztangą',    3, 10, 90),
    ],
  },
  {
    name: 'Legs · uda + łydki',
    exercises: [
      ex('squat',    'Przysiad ze sztangą',           4, 6,  180),
      ex('rdl',      'Rumuński martwy ciąg',          3, 8,  150),
      ex('legpress', 'Wypychanie na suwnicy',         3, 10, 120),
      ex('lunge',    'Wykroki z hantlami',            3, 10, 90),
      ex('legcurl',  'Uginanie nóg leżąc',            3, 12, 90),
      ex('calf',     'Wspięcia na palce',             4, 15, 60),
    ],
  },
]

/** Validates and normalizes exercises coming from the client. */
export function sanitizeTemplateExercises(input: unknown): TemplateExercise[] | null {
  if (!Array.isArray(input)) return null
  const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback
  }
  const out: TemplateExercise[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (typeof r.exerciseId !== 'string' || !r.exerciseId || typeof r.name !== 'string' || !r.name.trim()) return null
    const weight = Number(r.targetWeight)
    out.push({
      exerciseId:   r.exerciseId,
      name:         r.name.trim(),
      targetSets:   clampInt(r.targetSets, 1, 20, 3),
      targetReps:   clampInt(r.targetReps, 1, 100, 8),
      targetRepsMax: r.targetRepsMax != null && r.targetRepsMax !== '' ? Math.max(clampInt(r.targetRepsMax, 1, 100, 8), clampInt(r.targetReps, 1, 100, 8)) : null,
      targetWeight: r.targetWeight != null && r.targetWeight !== '' && Number.isFinite(weight) && weight > 0 ? weight : null,
      restSeconds:  clampInt(r.restSeconds, 0, 900, 120),
      superset:     out.length > 0 && r.superset === true,
    })
  }
  return out
}
