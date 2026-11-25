import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { MUSCLE_LABEL } from '@/components/MuscleMap'
import { useApi } from '@/lib/api'
import { POPULAR } from '@/lib/gym'
import { C, R } from '@/lib/theme'

/** Muscle groups of the picker, built from the exercise database's muscle names. */
const GROUPS = [
  { key: 'klatka', label: 'Klatka', muscles: ['chest'] },
  { key: 'plecy', label: 'Plecy', muscles: ['lats', 'middle back', 'lower back', 'traps'] },
  { key: 'barki', label: 'Barki', muscles: ['shoulders', 'neck'] },
  { key: 'ramiona', label: 'Ramiona', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'nogi', label: 'Nogi', muscles: ['quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors'] },
  { key: 'posladki', label: 'Pośladki', muscles: ['glutes'] },
  { key: 'brzuch', label: 'Brzuch', muscles: ['abdominals'] },
] as const
type GroupKey = typeof GROUPS[number]['key']

const groupOf = (muscle: string | undefined): GroupKey | null =>
  GROUPS.find(g => (g.muscles as readonly string[]).includes(muscle ?? ''))?.key ?? null

const POPULAR_GROUP: Record<string, GroupKey> = {
  Nogi: 'nogi', Klatka: 'klatka', Plecy: 'plecy', Barki: 'barki', Ramiona: 'ramiona', Brzuch: 'brzuch',
}

interface Item {
  id: string
  name: string
  /** Extra text that search also matches (English name, muscles). */
  search: string
  group: GroupKey | null
  also: string
  popular: boolean
}

interface CatalogRow {
  id: string
  name: string
  name_en?: string
  category: string | null
  primary_muscles: string[] | null
  secondary_muscles: string[] | null
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
const muscleNames = (list: string[] | null | undefined) => (list ?? []).map(m => MUSCLE_LABEL[m] ?? m)

const POPULAR_ITEMS: Item[] = POPULAR.map(p => ({
  id: p.id, name: p.name, search: norm(`${p.name} ${p.muscle}`),
  group: p.id === 'hipthrust' ? 'posladki' : POPULAR_GROUP[p.muscle] ?? null, also: '', popular: true,
}))

// Loaded once per app run: ~750 exercises, names and muscles only.
let catalogCache: Item[] | null = null

/** Exercise picker for a live workout: search (also by muscle), muscle-group filter, recent first. */
export function ExercisePicker({ partner, onPick, onCancel }: {
  /** Last exercise of the workout — the new one can join it as a superset. */
  partner: string | null
  onPick: (id: string, name: string, superset: boolean) => void
  onCancel: () => void
}) {
  const api = useApi()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<GroupKey | null>(null)
  const [superset, setSuperset] = useState(false)
  const [catalog, setCatalog] = useState<Item[] | null>(catalogCache)
  const [catalogFailed, setCatalogFailed] = useState(false)
  const [recent, setRecent] = useState<{ id: string; name: string }[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!catalogCache) {
      api<{ exercises: CatalogRow[] }>('/api/exercises?lite=1')
        .then(({ exercises }) => {
          catalogCache = exercises
            .filter(e => e.category !== 'stretching')
            .map(e => ({
              id: e.id, name: e.name, popular: false,
              group: groupOf(e.primary_muscles?.[0]),
              also: muscleNames([...(e.primary_muscles ?? []).slice(1), ...(e.secondary_muscles ?? [])]).slice(0, 3).join(', ').toLowerCase(),
              search: norm(`${e.name} ${e.name_en ?? ''} ${muscleNames(e.primary_muscles).join(' ')} ${muscleNames(e.secondary_muscles).join(' ')}`),
            }))
          setCatalog(catalogCache)
        })
        .catch(() => setCatalogFailed(true))
    }
    // Exercises from the last workouts, newest first.
    api<{ workouts: { workout_sets: { exercise_id: string; exercise_name: string | null }[] }[] }>('/api/gym/workouts?limit=8')
      .then(({ workouts }) => {
        const seen = new Map<string, string>()
        for (const w of workouts) for (const s of w.workout_sets) if (!seen.has(s.exercise_id)) seen.set(s.exercise_id, s.exercise_name ?? s.exercise_id)
        setRecent(Array.from(seen, ([id, name]) => ({ id, name })).slice(0, 6))
      })
      .catch(() => {})
  }, [api])

  const all = useMemo(() => [...POPULAR_ITEMS, ...(catalog ?? [])], [catalog])
  const query = norm(q.trim())

  // "plecy", "biceps" … also selects every exercise of that muscle group.
  const groupHits = useMemo(
    () => (query.length >= 3 ? GROUPS.filter(g => norm(g.label).startsWith(query)).map(g => g.key) : []),
    [query],
  )

  const sections = useMemo(() => {
    const items = all.filter(e => (!group || e.group === group) && (!query || e.search.includes(query) || (e.group && groupHits.includes(e.group))))
    return GROUPS
      .filter(g => !group || g.key === group)
      .map(g => ({ ...g, items: items.filter(e => e.group === g.key) }))
      .filter(s => s.items.length)
  }, [all, group, query, groupHits])

  const pick = (id: string, name: string) => onPick(id, name, superset)
  const showRecent = !query && !group && recent.length > 0

  return (
    <View style={st.card}>
      <View style={st.search}>
        <Ionicons name="search" size={16} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Szukaj ćwiczenia albo partii, np. plecy"
          placeholderTextColor={C.textDim} style={st.input} autoCorrect={false} />
        {!!q && <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Wyczyść"><Ionicons name="close" size={16} color={C.muted} /></Pressable>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingVertical: 10 }}>
        {[{ key: null, label: 'Wszystkie' }, ...GROUPS].map(g => {
          const on = group === g.key
          return (
            <Pressable key={g.label} onPress={() => setGroup(g.key)} style={[st.chip, on && st.chipOn]} accessibilityState={{ selected: on }}>
              <Text style={{ color: on ? C.lime : C.textDim, fontSize: 13 }}>{g.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {!!partner && (
        <Pressable onPress={() => setSuperset(v => !v)} style={[st.superset, superset && st.supersetOn]}
          accessibilityRole="checkbox" accessibilityState={{ checked: superset }}>
          <Ionicons name={superset ? 'checkbox' : 'square-outline'} size={20} color={superset ? C.orange : C.muted} />
          <Text style={{ color: superset ? C.orange : C.textDim, flex: 1, fontSize: 14 }} numberOfLines={2}>
            Superseria z: <Text style={{ fontWeight: '700' }}>{partner}</Text>
          </Text>
        </Pressable>
      )}

      {showRecent && (
        <>
          <Text style={st.group}>OSTATNIO</Text>
          {recent.map(r => <Row key={`r-${r.id}`} name={r.name} also="" onPress={() => pick(r.id, r.name)} />)}
        </>
      )}

      {sections.map(s => {
        // A picked group shows everything; search shows the best 40 per group; otherwise a preview of 5.
        const open = expanded[s.key] || !!query || !!group
        const shown = group ? s.items : query ? s.items.slice(0, 40) : s.items.slice(0, open ? 60 : 5)
        return (
          <View key={s.key}>
            <View style={st.groupRow}>
              <Text style={st.group}>{s.label.toUpperCase()}{groupHits.includes(s.key) ? ' · PARTIA' : ''}</Text>
              <Text style={st.group}>{s.items.length}</Text>
            </View>
            {shown.map(e => <Row key={e.id} name={e.name} also={e.also} onPress={() => pick(e.id, e.name)} />)}
            {s.items.length > shown.length && (
              <Pressable onPress={() => (open ? setGroup(s.key) : setExpanded(x => ({ ...x, [s.key]: true })))} style={st.more}>
                <Text style={{ color: C.lime, fontSize: 13 }}>
                  {open ? `Pokaż wszystkie: ${s.items.length}` : `Pokaż więcej: jeszcze ${s.items.length - shown.length}`}
                </Text>
              </Pressable>
            )}
          </View>
        )
      })}

      {!catalog && !catalogFailed && <Text style={st.note}>Ładuję bazę ćwiczeń…</Text>}
      {catalogFailed && <Text style={st.note}>Nie udało się wczytać bazy ćwiczeń. Pokazuję popularne.</Text>}
      {!!query && sections.length === 0 && catalog && <Text style={st.note}>Nic nie pasuje do „{q.trim()}”.</Text>}

      {!!q.trim() && (
        <Pressable onPress={() => pick(`custom:${q.trim().toLowerCase().replace(/\s+/g, '-')}`, q.trim())} style={st.row}>
          <Ionicons name="add" size={18} color={C.lime} />
          <Text style={{ color: C.lime, flex: 1 }}>Dodaj „{q.trim()}” jako własne ćwiczenie</Text>
        </Pressable>
      )}
      <Pressable onPress={onCancel} style={{ paddingVertical: 12 }}><Text style={{ color: C.muted, textAlign: 'center' }}>Anuluj</Text></Pressable>
    </View>
  )
}

function Row({ name, also, onPress }: { name: string; also: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.row, pressed && { backgroundColor: '#141414' }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 15 }}>{name}</Text>
        {!!also && <Text style={{ color: C.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>też: {also}</Text>}
      </View>
      <View style={st.add}><Ionicons name="add" size={16} color={C.lime} /></View>
    </Pressable>
  )
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderColor: C.limeLine, borderWidth: 1, borderRadius: R.lg, padding: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.field, borderColor: C.fieldBorder, borderWidth: 1, borderRadius: R.md, paddingHorizontal: 12 },
  input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 11 },
  chip: { borderWidth: 1, borderColor: C.fieldBorder, backgroundColor: C.field, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { borderColor: C.limeLine, backgroundColor: C.limeTint },
  superset: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4, padding: 12, borderRadius: R.md, borderWidth: 1, borderColor: C.cardBorder },
  supersetOn: { borderColor: 'rgba(245,160,58,0.45)', backgroundColor: 'rgba(245,160,58,0.08)' },
  groupRow: { flexDirection: 'row', justifyContent: 'space-between' },
  group: { color: C.muted, fontSize: 11, letterSpacing: 1.5, fontFamily: 'monospace', marginTop: 14, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  add: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: C.fieldBorder, alignItems: 'center', justifyContent: 'center' },
  more: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  note: { color: C.muted, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
})
