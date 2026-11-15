import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Btn, Card, ErrorBox, Kicker, Loading } from '@/components/ui'
import { useApi } from '@/lib/api'
import { fmtKg, fmtTonnes, formatPrescription, relativeDay, type GymOverview, type PlannedExercise, type WorkoutTemplate } from '@/lib/gym'
import { useStartWorkout } from '@/lib/start'
import { C, R } from '@/lib/theme'
import { useWorkout } from '@/lib/workout-store'

const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

const repsLabel = (min: number, max?: number | null) => (max && max !== min ? `${min}–${max}` : String(min))

const fromPlan = (e: PlannedExercise) => ({
  exerciseId: e.exerciseId,
  name: e.name,
  targetSets: e.sets,
  targetReps: e.repsMin ?? e.repsMax ?? 8,
  targetRepsMax: e.repsMax,
  targetWeight: e.weightKg,
  restSeconds: e.restSeconds ?? 120,
  plan: formatPrescription(e),
  notes: e.notes || undefined,
})

/** Gym home: this week, one big start for today, templates, latest record and weekly volume. */
export default function GymHome() {
  const api = useApi()
  const start = useStartWorkout()
  const active = useWorkout(s => s.workout)
  const [overview, setOverview] = useState<GymOverview | null>(null)
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [o, t] = await Promise.all([
        api<GymOverview>('/api/gym/overview'),
        api<{ templates: WorkoutTemplate[] }>('/api/gym/templates'),
      ])
      setOverview(o)
      setTemplates(t.templates)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać danych.')
      setTemplates(ts => ts ?? [])
    }
  }, [api])

  // Refresh when coming back from a finished workout.
  useFocusEffect(useCallback(() => { load() }, [load]))

  const suggested = useMemo(() => {
    if (!templates?.length) return null
    return [...templates].sort((a, b) => (a.last_used_at ?? '').localeCompare(b.last_used_at ?? ''))[0]
  }, [templates])

  const run = async (fn: () => Promise<void>) => {
    setStarting(true)
    try { await fn() } finally { setStarting(false) }
  }

  const plan = overview?.planToday
  const hero = plan
    ? {
        kicker: 'Dziś · od trenera', name: plan.name, note: plan.notes,
        items: plan.exercises.map(e => `${e.name} ${e.sets}×${repsLabel(e.repsMin ?? e.repsMax ?? 0, e.repsMax)}`),
        go: () => run(() => start(plan.name, plan.exercises.map(fromPlan), undefined, plan.notes)),
      }
    : suggested
      ? {
          kicker: suggested.last_used_at ? `Proponowany · ostatnio ${relativeDay(suggested.last_used_at)}` : 'Proponowany', name: suggested.name, note: '',
          items: suggested.exercises.map(e => `${e.name} ${e.targetSets}×${repsLabel(e.targetReps, e.targetRepsMax)}`),
          go: () => run(() => start(suggested.name, suggested.exercises, suggested.id)),
        }
      : null

  const week = overview?.week
  const delta = overview && overview.tonnage.lastWeek > 0
    ? Math.round(((overview.tonnage.thisWeek - overview.tonnage.lastWeek) / overview.tonnage.lastWeek) * 100) : null
  const pr = overview?.recentPrs[0]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.lime} colors={[C.lime]} progressBackgroundColor={C.card}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}>

        <View style={s.rowBetween}>
          <View>
            <Kicker>Siłownia</Kicker>
            <Text style={s.h1}>Ten tydzień</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.counter}>{week ? `${week.done}${week.goal ? `/${week.goal}` : ''}` : '–'}</Text>
            <Kicker>treningi</Kicker>
          </View>
        </View>

        <View style={s.week}>
          {DAYS.map((d, i) => {
            const done = week?.days[i]
            const today = week?.today === i
            return (
              <View key={d} style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 11, color: today ? C.lime : C.faint }}>{d}</Text>
                <View style={[s.dot, done ? { backgroundColor: C.lime } : today ? { borderWidth: 2, borderColor: C.lime } : { backgroundColor: '#141414' }]}>
                  {done && <Ionicons name="checkmark" size={18} color={C.limeDark} />}
                </View>
              </View>
            )
          })}
        </View>

        <ErrorBox message={error} />

        {active ? (
          <Pressable onPress={() => router.push('/workout')} style={[s.hero, { backgroundColor: C.orange }]}>
            <Text style={[s.heroKicker, { color: C.orangeDark }]}>TRENING TRWA</Text>
            <Text style={[s.heroName, { color: C.orangeDark }]}>{active.name}</Text>
            <View style={[s.heroBtn]}><Text style={{ color: C.orange, fontWeight: '700' }}>Wróć do treningu →</Text></View>
          </Pressable>
        ) : hero ? (
          <View style={s.hero}>
            <Text style={s.heroKicker}>{hero.kicker.toUpperCase()}</Text>
            <Text style={s.heroName}>{hero.name}</Text>
            {!!hero.note && <Text style={s.heroNote}><Text style={{ fontWeight: '700' }}>Uwaga trenera: </Text>{hero.note}</Text>}
            <Text style={s.heroItems} numberOfLines={2}>
              {hero.items.slice(0, 3).join(' · ')}{hero.items.length > 3 ? ` · +${hero.items.length - 3}` : ''}
            </Text>
            <Btn title="▶  Rozpocznij" variant="dark" onPress={hero.go} loading={starting} />
          </View>
        ) : templates === null ? <Loading /> : null}

        <View style={[s.rowBetween, { marginTop: 20, marginBottom: 8 }]}>
          <Kicker>Szablony</Kicker>
        </View>
        <Card style={{ paddingVertical: 0 }}>
          {templates?.map((t, i) => (
            <Pressable key={t.id} disabled={starting} onPress={() => run(() => start(t.name, t.exercises, t.id))}
              style={({ pressed }) => [s.row, i > 0 && s.rowBorder, pressed && { opacity: 0.6 }]}>
              <Text style={s.rowTitle} numberOfLines={1}>{t.name}</Text>
              <Text style={s.rowMeta}>{t.exercises.length} ćw · {t.last_used_at ? relativeDay(t.last_used_at) : 'nowy'}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.faint} />
            </Pressable>
          ))}
          <Pressable disabled={starting} onPress={() => run(() => start(`Trening ${new Date().toLocaleDateString('pl-PL')}`, []))}
            style={({ pressed }) => [s.row, !!templates?.length && s.rowBorder, pressed && { opacity: 0.6 }]}>
            <Text style={[s.rowTitle, { color: C.textDim }]}>Pusty trening</Text>
            <Ionicons name="add" size={18} color={C.faint} />
          </Pressable>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Card style={{ flex: 1 }}>
            <Kicker>Rekord</Kicker>
            {pr ? (
              <>
                <Text style={{ color: '#ccc', fontSize: 13, marginTop: 8 }} numberOfLines={1}>{pr.name}</Text>
                <Text style={s.stat}>{fmtKg(pr.weight)} kg <Text style={{ color: C.lime, fontSize: 12 }}>× {pr.reps}</Text></Text>
                <Text style={s.statSub}>{relativeDay(pr.at)}</Text>
              </>
            ) : <Text style={[s.statSub, { marginTop: 8 }]}>{overview ? 'Brak w ostatnim miesiącu' : '…'}</Text>}
          </Card>
          <Card style={{ flex: 1 }}>
            <Kicker>Tonaż tygodnia</Kicker>
            <Text style={[s.stat, { marginTop: 8 }]}>{overview ? fmtTonnes(overview.tonnage.thisWeek) : '–'}</Text>
            <Text style={[s.statSub, delta != null && { color: delta >= 0 ? C.lime : C.orange }]}>
              {delta == null ? 'brak porównania' : `${delta >= 0 ? '+' : ''}${delta}% vs poprz.`}
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  h1: { color: C.text, fontSize: 26, fontWeight: '800' },
  counter: { color: C.lime, fontSize: 24, fontWeight: '800' },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 16 },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: C.lime, borderRadius: R.xl, padding: 16, gap: 6 },
  heroKicker: { color: '#1a2400', fontSize: 11, letterSpacing: 1.5, fontFamily: 'monospace' },
  heroName: { color: '#1a2400', fontSize: 24, fontWeight: '800' },
  heroNote: { color: '#1a2400', fontSize: 13, backgroundColor: 'rgba(26,36,0,0.1)', borderRadius: R.sm, padding: 8 },
  heroItems: { color: '#1a2400', fontSize: 13, marginBottom: 6 },
  heroBtn: { backgroundColor: C.bg, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  rowTitle: { color: C.text, fontSize: 15, flex: 1 },
  rowMeta: { color: C.muted, fontSize: 12 },
  stat: { color: C.text, fontSize: 20, fontWeight: '800' },
  statSub: { color: C.muted, fontSize: 11 },
})
