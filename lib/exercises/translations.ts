// ─── KATEGORIE GŁÓWNE ─────────────────────────────────────────────────────────

export const CATEGORY_PL: Record<string, string> = {
  strength:    'Siła',
  stretching:  'Rozciąganie',
  plyometrics: 'Plyometria',
  strongman:   'Strongman',
  powerlifting:'Trójbój',
  cardio:      'Kardio',
  olympic_weightlifting: 'Podnoszenie ciężarów',
  crossfit:    'Crossfit',
}

// ─── POZIOMY TRUDNOŚCI ────────────────────────────────────────────────────────

export const LEVEL_PL: Record<string, string> = {
  beginner:     'Początkujący',
  intermediate: 'Średniozaawansowany',
  expert:       'Zaawansowany',
}

// ─── TYP SIŁY ─────────────────────────────────────────────────────────────────

export const FORCE_PL: Record<string, string> = {
  push:   'Wypychanie',
  pull:   'Przyciąganie',
  static: 'Izometryczne',
}

// ─── MECHANIKA ────────────────────────────────────────────────────────────────

export const MECHANIC_PL: Record<string, string> = {
  compound:  'Wielostawowe',
  isolation: 'Izolowane',
}

// ─── SPRZĘT ───────────────────────────────────────────────────────────────────

export const EQUIPMENT_PL: Record<string, string> = {
  'body only':       'Masa ciała',
  'barbell':         'Sztanga',
  'dumbbell':        'Hantle',
  'kettlebells':     'Kettlebell',
  'machine':         'Maszyna',
  'cable':           'Wyciąg',
  'bands':           'Gumy',
  'medicine ball':   'Piłka lekarska',
  'exercise ball':   'Piłka gimnastyczna',
  'foam roll':       'Roller',
  'e-z curl bar':    'Łamana sztanga',
  'other':           'Inne',
  'none':            'Brak',
}

// ─── GRUPY MIĘŚNIOWE ──────────────────────────────────────────────────────────

export const MUSCLE_PL: Record<string, string> = {
  chest:        'Klatka piersiowa',
  lats:         'Najszersze grzbietu',
  middle_back:  'Środkowe plecy',
  lower_back:   'Dolne plecy',
  traps:        'Czworoboczne',
  neck:         'Szyja',
  shoulders:    'Barki',
  biceps:       'Biceps',
  triceps:      'Triceps',
  forearms:     'Przedramiona',
  abdominals:   'Brzuch',
  quadriceps:   'Czworogłowe',
  hamstrings:   'Dwugłowe',
  glutes:       'Pośladki',
  calves:       'Łydki',
  abductors:    'Odwodziciele',
  adductors:    'Przywodziciele',
}

export const MUSCLE_GROUP_PL = {
  chest:    { label: 'Klatka',   muscles: ['chest'] },
  back:     { label: 'Plecy',    muscles: ['lats', 'middle_back', 'lower_back', 'traps'] },
  shoulders:{ label: 'Barki',    muscles: ['shoulders', 'neck'] },
  arms:     { label: 'Ramiona',  muscles: ['biceps', 'triceps', 'forearms'] },
  core:     { label: 'Brzuch',   muscles: ['abdominals'] },
  legs:     { label: 'Nogi',     muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'] },
} as const

export type MuscleGroupKey = keyof typeof MUSCLE_GROUP_PL

export function muscleToGroup(muscle: string): MuscleGroupKey | null {
  for (const [key, cfg] of Object.entries(MUSCLE_GROUP_PL) as [MuscleGroupKey, typeof MUSCLE_GROUP_PL[MuscleGroupKey]][]) {
    if ((cfg.muscles as readonly string[]).includes(muscle)) return key
  }
  return null
}

export function translate(value: string | null | undefined, dict: Record<string, string>): string {
  if (!value) return '—'
  return dict[value] ?? value
}
