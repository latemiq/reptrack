// Which muscle groups an exercise works, for the weekly 3D muscle map.
// Group names match free-exercise-db (and the `exercises` table) and the groups baked into
// the 3D model in public/muscle-map/model.glb.

export const MUSCLE_GROUPS = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals',
  'lats', 'middle back', 'traps', 'lower back', 'neck',
  'glutes', 'quadriceps', 'hamstrings', 'adductors', 'abductors', 'calves',
] as const
export type MuscleGroup = typeof MUSCLE_GROUPS[number]

export interface ExerciseMuscles {
  primary: MuscleGroup[]
  secondary: MuscleGroup[]
}

const M = (primary: MuscleGroup[], secondary: MuscleGroup[] = []): ExerciseMuscles => ({ primary, secondary })

/** Exercises from lib/exercises/popular.ts (ids used by default templates and the mobile picker). */
const POPULAR: Record<string, ExerciseMuscles> = {
  squat: M(['quadriceps', 'glutes'], ['adductors', 'hamstrings', 'lower back']),
  frontsquat: M(['quadriceps'], ['glutes', 'abdominals']),
  bench: M(['chest'], ['triceps', 'shoulders']),
  incline: M(['chest'], ['shoulders', 'triceps']),
  deadlift: M(['lower back', 'hamstrings', 'glutes'], ['quadriceps', 'traps', 'forearms']),
  rdl: M(['hamstrings', 'glutes'], ['lower back']),
  ohp: M(['shoulders'], ['triceps', 'traps']),
  pullup: M(['lats'], ['biceps', 'middle back']),
  row: M(['middle back', 'lats'], ['biceps', 'lower back']),
  latpulldown: M(['lats'], ['biceps', 'middle back']),
  cablerow: M(['middle back', 'lats'], ['biceps']),
  dips: M(['chest', 'triceps'], ['shoulders']),
  pushup: M(['chest'], ['triceps', 'shoulders']),
  fly: M(['chest'], ['shoulders']),
  lateralraise: M(['shoulders']),
  facepull: M(['shoulders'], ['middle back', 'traps']),
  curl: M(['biceps'], ['forearms']),
  hammercurl: M(['biceps', 'forearms']),
  pushdown: M(['triceps']),
  skullcrusher: M(['triceps']),
  legpress: M(['quadriceps'], ['glutes', 'hamstrings']),
  lunge: M(['quadriceps', 'glutes'], ['hamstrings', 'adductors']),
  bulgarian: M(['quadriceps', 'glutes'], ['hamstrings', 'adductors']),
  legext: M(['quadriceps']),
  legcurl: M(['hamstrings']),
  hipthrust: M(['glutes'], ['hamstrings']),
  calf: M(['calves']),
  plank: M(['abdominals']),
  hangingraise: M(['abdominals']),
}

/**
 * Name rules for exercises without muscle data (custom exercises from trainer plans, e.g.
 * "custom:podciaganie-nachwyt"). Checked in order on a lowercase name without Polish diacritics;
 * the first match wins, so more specific patterns come first.
 */
const RULES: [RegExp, ExerciseMuscles][] = [
  [/uginanie nog|leg curl|nordic/, M(['hamstrings'])],
  [/prostowanie nog|leg ext/, M(['quadriceps'])],
  [/unoszenie nog|leg raise|knee raise/, M(['abdominals'])],
  [/odwodz\w* nog|odwodziciel|abduct/, M(['abductors'], ['glutes'])],
  [/przywodz|adduct/, M(['adductors'])],
  [/wspiec|calf|lydk/, M(['calves'])],
  [/hip thrust|most biodr|glute|poslad|kickback/, M(['glutes'], ['hamstrings'])],
  [/rumun|rdl|romanian|stiff/, M(['hamstrings', 'glutes'], ['lower back'])],
  [/martwy|deadlift/, M(['lower back', 'hamstrings', 'glutes'], ['quadriceps', 'traps', 'forearms'])],
  [/hiperekst|hyperext|back ext|dzien dobry|good morning|superman/, M(['lower back'], ['glutes', 'hamstrings'])],
  [/przysiad|squat|suwnic|leg press|wykrok|zakrok|lunge|bulgar|step.?up|wejsci/, M(['quadriceps', 'glutes'], ['hamstrings', 'adductors'])],
  [/podciag|pull.?up|chin.?up/, M(['lats'], ['biceps', 'middle back'])],
  [/sciaganie|pulldown|pull.?down/, M(['lats'], ['biceps', 'middle back'])],
  [/wioslow|row\b|rowing/, M(['middle back', 'lats'], ['biceps'])],
  [/szrug|shrug/, M(['traps'])],
  [/cuban|face.?pull|tylny akton|tyl barku|reverse fly|odwrotne rozpietki/, M(['shoulders'], ['traps', 'middle back'])],
  [/wask\w* chwyt|close.?grip|diamentow/, M(['triceps', 'chest'], ['shoulders'])],
  [/nad glow|zolniersk|ohp|overhead|military|arnold|wyciskanie (hantli |sztangi )?(stojac|siedzac)/, M(['shoulders'], ['triceps'])],
  [/odwodzenie ramion|wzno\w* .*bok|unoszenie .*bok|lateral|w bok/, M(['shoulders'])],
  [/poreczach|dips/, M(['chest', 'triceps'], ['shoulders'])],
  [/wyciskanie|bench|press|pompk|push.?up|rozpietk|fly|brama|crossover/, M(['chest'], ['triceps', 'shoulders'])],
  [/mlotkow|hammer/, M(['biceps', 'forearms'])],
  [/biceps|uginanie (ramion|przedramion|hantli|sztangi)|curl/, M(['biceps'], ['forearms'])],
  [/triceps|prostowanie ramion|francusk|pushdown|skull|extension/, M(['triceps'])],
  [/nadgarst|wrist|farmer|przedrami/, M(['forearms'])],
  [/deska|plank|brzuch|crunch|spiec|skret|woodchop|chopper|pallof|russian|ab wheel|kolk|sit.?up|dead bug|hollow/, M(['abdominals'])],
  [/szyj|neck/, M(['neck'])],
]

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

const asGroups = (list: readonly string[] | null | undefined): MuscleGroup[] =>
  (list ?? []).map(m => m.replace(/_/g, ' ')).filter((m): m is MuscleGroup => (MUSCLE_GROUPS as readonly string[]).includes(m))

/**
 * Muscle groups for one exercise: muscles stored in the exercise database win, then the popular
 * exercise table, then name rules (Polish or English). Unknown exercises return no groups.
 */
export function exerciseMuscles(
  exerciseId: string,
  name: string | null | undefined,
  fromDb?: { primary_muscles?: string[] | null; secondary_muscles?: string[] | null } | null,
): ExerciseMuscles {
  if (fromDb) {
    const primary = asGroups(fromDb.primary_muscles)
    if (primary.length) return { primary, secondary: asGroups(fromDb.secondary_muscles).filter(m => !primary.includes(m)) }
  }
  const popular = POPULAR[exerciseId]
  if (popular) return popular
  const text = normalize(`${name ?? ''} ${exerciseId.replace(/^custom:/, '').replace(/-/g, ' ')}`)
  for (const [re, muscles] of RULES) if (re.test(text)) return muscles
  return { primary: [], secondary: [] }
}

/** Sets per muscle group: a set counts fully for its main muscles and half for the helping ones. */
export const SECONDARY_SET_WEIGHT = 0.5
