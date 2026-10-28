// Common gym exercises with Polish names. The atlas (free-exercise-db) is English-only,
// so the picker shows these first and matches Polish queries against them.
// IDs match the ones used by default templates and existing workout history.

export interface PopularExercise {
  id: string
  name: string
  muscle: string
  /** Extra search terms (English names, slang). */
  aliases: string[]
}

const E = (id: string, name: string, muscle: string, ...aliases: string[]): PopularExercise => ({ id, name, muscle, aliases })

export const POPULAR_EXERCISES: PopularExercise[] = [
  E('squat',        'Przysiad ze sztangą',            'Nogi',    'back squat', 'squat'),
  E('frontsquat',   'Przysiad przedni',               'Nogi',    'front squat'),
  E('bench',        'Wyciskanie sztangi na ławce',    'Klatka',  'bench press', 'klata'),
  E('incline',      'Wyciskanie hantli skos góra',    'Klatka',  'incline dumbbell press'),
  E('deadlift',     'Martwy ciąg',                    'Plecy',   'deadlift', 'mc'),
  E('rdl',          'Rumuński martwy ciąg',           'Nogi',    'romanian deadlift', 'rdl'),
  E('ohp',          'OHP — wyciskanie żołnierskie',   'Barki',   'overhead press', 'military press'),
  E('pullup',       'Podciąganie na drążku',          'Plecy',   'pull up', 'chin up'),
  E('row',          'Wiosłowanie sztangą',            'Plecy',   'barbell row', 'bent over row'),
  E('latpulldown',  'Ściąganie drążka wyciągu górnego', 'Plecy', 'lat pulldown'),
  E('cablerow',     'Wiosłowanie na wyciągu dolnym',  'Plecy',   'seated cable row'),
  E('dips',         'Pompki na poręczach',            'Klatka',  'dips'),
  E('pushup',       'Pompki',                         'Klatka',  'push up'),
  E('fly',          'Rozpiętki z hantlami',           'Klatka',  'dumbbell fly'),
  E('lateralraise', 'Wznosy hantli bokiem',           'Barki',   'lateral raise'),
  E('facepull',     'Face pull',                      'Barki',   'face pull'),
  E('curl',         'Uginanie ramion ze sztangą',     'Ramiona', 'barbell curl', 'biceps'),
  E('hammercurl',   'Uginanie młotkowe',              'Ramiona', 'hammer curl', 'biceps'),
  E('pushdown',     'Prostowanie ramion na wyciągu',  'Ramiona', 'triceps pushdown', 'triceps'),
  E('skullcrusher', 'Wyciskanie francuskie',          'Ramiona', 'skull crusher', 'triceps'),
  E('legpress',     'Wypychanie na suwnicy',          'Nogi',    'leg press'),
  E('lunge',        'Wykroki z hantlami',             'Nogi',    'lunge', 'zakroki'),
  E('bulgarian',    'Przysiad bułgarski',             'Nogi',    'bulgarian split squat'),
  E('legext',       'Prostowanie nóg na maszynie',    'Nogi',    'leg extension', 'czworogłowe'),
  E('legcurl',      'Uginanie nóg leżąc',             'Nogi',    'leg curl', 'dwugłowe'),
  E('hipthrust',    'Hip thrust',                     'Nogi',    'hip thrust', 'pośladki', 'glute bridge'),
  E('calf',         'Wspięcia na palce',              'Nogi',    'calf raise', 'łydki'),
  E('plank',        'Deska (plank)',                  'Brzuch',  'plank'),
  E('hangingraise', 'Unoszenie nóg w zwisie',         'Brzuch',  'hanging leg raise'),
]
