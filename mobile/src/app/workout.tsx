import Ionicons from '@expo/vector-icons/Ionicons'
import * as Haptics from 'expo-haptics'
import { useKeepAwake } from 'expo-keep-awake'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Btn, ErrorBox } from '@/components/ui'
import { useApi } from '@/lib/api'
import { fmtKg, fmtTonnes, POPULAR } from '@/lib/gym'
import { cancelRestEnd, scheduleRestEnd } from '@/lib/rest-alert'
import { usePrevious } from '@/lib/start'
import { C, R } from '@/lib/theme'
import { progress, useWorkout, type ExerciseEntry, type SetEntry } from '@/lib/workout-store'

const fmtTime = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
const isDone = (e: ExerciseEntry) => e.sets.length > 0 && e.sets.every(s => s.done)
const parseNum = (t: string) => { const n = Number(t.replace(',', '.')); return t.trim() === '' || Number.isNaN(n) ? null : n }

/** Keeps what's being typed ("42," on the way to "42,5"); shows Polish formatting otherwise. */
function NumField({ value, onChange, done, placeholder, integer }: {
  value: number | null; onChange: (v: number | null) => void; done: boolean; placeholder: string; integer?: boolean
}) {
  const [text, setText] = useState<string | null>(null)
  return (
    <TextInput
      value={text ?? (value != null ? fmtKg(value) : '')}
      onFocus={() => setText(value != null ? fmtKg(value) : '')}
      onBlur={() => setText(null)}
      onChangeText={t => { const clean = t.replace(/[^\d.,]/g, ''); setText(clean); const n = parseNum(clean); onChange(n == null ? null : integer ? Math.round(n) : n) }}
      editable={!done}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      placeholder={placeholder}
      placeholderTextColor="#444"
      selectTextOnFocus
      style={[st.num, done && st.numDone]}
    />
  )
}

function ExerciseCard({ ex, expanded, onExpand, onSetDone }: {
  ex: ExerciseEntry; expanded: boolean; onExpand: () => void; onSetDone: (ex: ExerciseEntry) => void
}) {
  const { updateSet, addSet, removeLastSet, removeExercise } = useWorkout()
  const doneCount = ex.sets.filter(s => s.done).length
  const done = isDone(ex)

  if (!expanded) {
    return (
      <Pressable onPress={onExpand} style={st.collapsed}>
        <Text style={[st.collapsedName, done && { color: C.muted }]} numberOfLines={1}>{ex.name}</Text>
        <Text style={{ color: done ? C.lime : C.muted, fontFamily: 'monospace', fontSize: 12 }}>{doneCount}/{ex.sets.length}</Text>
        {done && <Ionicons name="checkmark" size={16} color={C.lime} />}
      </Pressable>
    )
  }

  const toggle = (s: SetEntry) => {
    if (s.done) { updateSet(ex.id, s.id, { done: false, completedAt: undefined }); return }
    updateSet(ex.id, s.id, { done: true, completedAt: Date.now() })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    onSetDone(ex)
  }

  return (
    <View style={st.card}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={st.exName}>{ex.name}</Text>
          <Text style={st.exPlan}>
            {ex.plan ? `Plan: ${ex.plan}` : `Cel: ${ex.targetSets}×${ex.targetRepsMax && ex.targetRepsMax !== ex.targetReps ? `${ex.targetReps}–${ex.targetRepsMax}` : ex.targetReps}${ex.targetWeight ? ` @ ${fmtKg(ex.targetWeight)} kg` : ''}`}
            {ex.restSeconds ? ` · przerwa ${fmtTime(ex.restSeconds)}` : ''}
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={() => Alert.alert(ex.name, undefined, [
          { text: 'Usuń ćwiczenie', style: 'destructive', onPress: () => removeExercise(ex.id) },
          { text: 'Anuluj', style: 'cancel' },
        ])}>
          <Ionicons name="ellipsis-horizontal" size={20} color={C.muted} />
        </Pressable>
      </View>

      {!!ex.notes && (
        <View style={st.note}><Text style={{ color: '#d8e8b0', fontSize: 13 }}><Text style={{ color: C.lime }}>Trener: </Text>{ex.notes}</Text></View>
      )}

      <View style={[st.setRow, { marginTop: 10 }]}>
        <Text style={[st.head, { width: 28 }]}>SER</Text>
        <Text style={[st.head, { flex: 1 }]}>POPRZ.</Text>
        <Text style={[st.head, { width: 74, textAlign: 'center' }]}>KG</Text>
        <Text style={[st.head, { width: 58, textAlign: 'center' }]}>POWT</Text>
        <View style={{ width: 44 }} />
      </View>
      {ex.sets.map((s, i) => {
        const prev = ex.previous?.[i]
        return (
          <View key={s.id} style={[st.setRow, s.done && st.setDone]}>
            <Text style={{ width: 28, color: s.done ? C.lime : C.textDim, fontFamily: 'monospace', fontSize: 14 }}>{i + 1}</Text>
            <Text style={{ flex: 1, color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>
              {prev ? `${prev.weightKg != null ? fmtKg(prev.weightKg) : '–'}×${prev.reps ?? '–'}` : '—'}
            </Text>
            <View style={{ width: 74, paddingHorizontal: 3 }}>
              <NumField value={s.weightKg} done={s.done} placeholder={prev?.weightKg != null ? fmtKg(prev.weightKg) : 'kg'}
                onChange={v => updateSet(ex.id, s.id, { weightKg: v })} />
            </View>
            <View style={{ width: 58, paddingHorizontal: 3 }}>
              <NumField value={s.reps} done={s.done} integer placeholder={prev?.reps != null ? String(prev.reps) : '–'}
                onChange={v => updateSet(ex.id, s.id, { reps: v })} />
            </View>
            <Pressable onPress={() => toggle(s)} hitSlop={6} style={[st.check, s.done && st.checkDone]}
              accessibilityLabel={s.done ? 'Cofnij zaliczenie serii' : 'Zalicz serię'}>
              <Ionicons name="checkmark" size={20} color={s.done ? C.limeDark : '#444'} />
            </Pressable>
          </View>
        )
      })}
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        <Pressable onPress={() => addSet(ex.id)} style={{ flex: 1, paddingVertical: 10 }}>
          <Text style={{ color: C.textDim, textAlign: 'center', fontSize: 13 }}>+ Dodaj serię</Text>
        </Pressable>
        {ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done && (
          <Pressable onPress={() => removeLastSet(ex.id)} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text style={{ color: C.muted, fontSize: 13 }}>− Usuń</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function RestBar() {
  const rest = useWorkout(s => s.rest)
  const setRest = useWorkout(s => s.setRest)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!rest) return
    const i = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(i)
  }, [rest])

  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0

  useEffect(() => {
    if (rest && remaining === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setRest(null)
    }
  }, [rest, remaining, setRest])

  if (!rest) return null

  const shift = async (sec: number) => {
    cancelRestEnd(rest.notificationId)
    const endsAt = Math.max(Date.now() + 1000, rest.endsAt + sec * 1000)
    const id = await scheduleRestEnd((endsAt - Date.now()) / 1000, 'następna seria')
    setRest({ endsAt, total: Math.max(1, rest.total + sec), notificationId: id })
  }
  const skip = () => { cancelRestEnd(rest.notificationId); setRest(null) }

  return (
    <View style={st.rest}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.orange, fontSize: 11, letterSpacing: 1.5, fontFamily: 'monospace' }}>PRZERWA</Text>
          <Text style={{ color: C.text, fontSize: 30, fontFamily: 'monospace' }}>{fmtTime(remaining)}</Text>
        </View>
        <Pressable onPress={() => shift(-15)} style={st.pill}><Text style={st.pillText}>−15 s</Text></Pressable>
        <Pressable onPress={() => shift(15)} style={st.pill}><Text style={st.pillText}>+15 s</Text></Pressable>
        <Pressable onPress={skip} style={[st.pill, { backgroundColor: C.orange }]}><Text style={[st.pillText, { color: C.orangeDark, fontWeight: '700' }]}>Pomiń</Text></Pressable>
      </View>
      <View style={st.restTrack}><View style={[st.restFill, { width: `${(remaining / rest.total) * 100}%` }]} /></View>
    </View>
  )
}

function AddExercise({ onPick, onCancel }: { onPick: (id: string, name: string) => void; onCancel: () => void }) {
  const [q, setQ] = useState('')
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
  const results = useMemo(() => {
    const n = norm(q.trim())
    return n ? POPULAR.filter(p => norm(`${p.name} ${p.muscle}`).includes(n)) : POPULAR.slice(0, 8)
  }, [q])
  return (
    <View style={st.card}>
      <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Szukaj (np. przysiad, plecy) lub wpisz nazwę"
        placeholderTextColor="#555" style={[st.num, { textAlign: 'left', paddingHorizontal: 12, fontSize: 15 }]} />
      {results.map(r => (
        <Pressable key={r.id} onPress={() => onPick(r.id, r.name)} style={st.pickRow}>
          <Text style={{ color: C.text, flex: 1 }}>{r.name}</Text>
          <Text style={{ color: C.faint, fontSize: 11 }}>{r.muscle.toUpperCase()}</Text>
        </Pressable>
      ))}
      {!!q.trim() && (
        <Pressable onPress={() => onPick(`custom:${q.trim().toLowerCase().replace(/\s+/g, '-')}`, q.trim())} style={st.pickRow}>
          <Text style={{ color: C.lime }}>+ Dodaj „{q.trim()}” jako własne ćwiczenie</Text>
        </Pressable>
      )}
      <Pressable onPress={onCancel} style={{ paddingVertical: 10 }}><Text style={{ color: C.muted, textAlign: 'center' }}>Anuluj</Text></Pressable>
    </View>
  )
}

/** Live workout. Everything is stored on the phone until "Zakończ" sends it to the server. */
export default function WorkoutScreen() {
  useKeepAwake()
  const api = useApi()
  const fetchPrevious = usePrevious()
  const workout = useWorkout(s => s.workout)
  const { finish, addExercise, setRest, rest } = useWorkout()
  const [elapsed, setElapsed] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workout) return
    const tick = () => setElapsed(Math.floor((Date.now() - workout.startedAt) / 1000))
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [workout])

  if (!workout) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 16 }}>Brak aktywnego treningu</Text>
        <Btn title="Wróć" onPress={() => router.back()} />
      </SafeAreaView>
    )
  }

  const p = progress(workout)
  const firstOpen = workout.exercises.find(e => !isDone(e))?.id ?? null
  const expanded = openId && workout.exercises.some(e => e.id === openId) ? openId : firstOpen

  const onSetDone = async (ex: ExerciseEntry) => {
    if (!ex.restSeconds) return
    cancelRestEnd(rest?.notificationId)
    const notificationId = await scheduleRestEnd(ex.restSeconds, ex.name)
    setRest({ endsAt: Date.now() + ex.restSeconds * 1000, total: ex.restSeconds, notificationId })
  }

  const pick = async (exerciseId: string, name: string) => {
    setPicking(false)
    const previous = (await fetchPrevious([exerciseId]))[exerciseId]
    const id = addExercise({ exerciseId, name, targetSets: previous?.length || 3, targetReps: previous?.[0]?.reps ?? 8, targetWeight: null, restSeconds: 120, previous })
    setOpenId(id)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api('/api/gym/workouts', { method: 'POST', body: JSON.stringify({
        templateId: workout.templateId, name: workout.name, startedAt: workout.startedAt,
        exercises: workout.exercises.map(e => ({ exerciseId: e.exerciseId, name: e.name, sets: e.sets })),
      }) })
      cancelRestEnd(rest?.notificationId)
      finish()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      router.replace('/history')
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Nie udało się zapisać.'} Trening jest nadal zapisany w telefonie — spróbuj ponownie.`)
      setSaving(false)
    }
  }

  const askFinish = () => {
    const left = p.total - p.done
    if (left === 0) { save(); return }
    Alert.alert('Zakończyć trening?', `Zostało ${left} niezaliczonych serii. Zapiszą się tylko zaliczone.`, [
      { text: 'Wróć', style: 'cancel' },
      { text: 'Zakończ', onPress: save },
    ])
  }

  const askCancel = () => Alert.alert('Anulować trening?', 'Zalogowane serie zostaną utracone.', [
    { text: 'Nie', style: 'cancel' },
    { text: 'Anuluj trening', style: 'destructive', onPress: () => { cancelRestEnd(rest?.notificationId); finish(); router.back() } },
  ])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={st.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-down" size={26} color={C.textDim} /></Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{workout.name}</Text>
          <Text style={{ color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>{fmtTime(elapsed)} · {fmtTonnes(p.tonnage)}</Text>
        </View>
        <Btn title={saving ? '…' : 'Zakończ'} onPress={askFinish} loading={saving} style={{ minHeight: 38, paddingHorizontal: 14 }} />
      </View>
      <View style={st.progress}><View style={[st.progressFill, { width: `${p.pct}%` }]} /></View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <ErrorBox message={error} />
          {!!workout.trainerNote && (
            <View style={[st.note, { marginTop: 0 }]}>
              <Text style={{ color: C.lime, fontSize: 11, letterSpacing: 1.5, fontFamily: 'monospace', marginBottom: 2 }}>UWAGA TRENERA DO TRENINGU</Text>
              <Text style={{ color: '#d8e8b0', fontSize: 14 }}>{workout.trainerNote}</Text>
            </View>
          )}
          {workout.exercises.length === 0 && !picking && (
            <Text style={{ color: C.muted, textAlign: 'center', paddingVertical: 24 }}>Pusty trening — dodaj pierwsze ćwiczenie.</Text>
          )}
          {workout.exercises.map(ex => (
            <ExerciseCard key={ex.id} ex={ex} expanded={ex.id === expanded} onExpand={() => setOpenId(ex.id)} onSetDone={onSetDone} />
          ))}
          {picking
            ? <AddExercise onPick={pick} onCancel={() => setPicking(false)} />
            : (
              <Pressable onPress={() => setPicking(true)} style={st.addBtn}>
                <Text style={{ color: C.textDim, fontSize: 14 }}>+ Dodaj ćwiczenie</Text>
              </Pressable>
            )}
          <Pressable onPress={askCancel} style={{ paddingVertical: 12 }}>
            <Text style={{ color: C.faint, textAlign: 'center', fontSize: 13 }}>Anuluj trening</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <RestBar />
    </SafeAreaView>
  )
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  progress: { height: 4, backgroundColor: '#1a1a1a', marginHorizontal: 16, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.lime },
  card: { backgroundColor: C.card, borderColor: C.limeLine, borderWidth: 1, borderRadius: R.lg, padding: 12 },
  collapsed: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderColor: C.cardBorder, borderWidth: 1, borderRadius: R.lg, paddingHorizontal: 14, paddingVertical: 14 },
  collapsedName: { color: C.text, fontSize: 15, flex: 1 },
  exName: { color: C.lime, fontSize: 16, fontWeight: '700' },
  exPlan: { color: C.muted, fontSize: 12, marginTop: 2 },
  note: { backgroundColor: C.limeTint, borderColor: 'rgba(200,245,58,0.18)', borderWidth: 1, borderRadius: R.sm, padding: 10, marginTop: 8 },
  head: { color: C.faint, fontSize: 11, fontFamily: 'monospace' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 4, borderRadius: R.sm },
  setDone: { backgroundColor: '#162000' },
  num: { backgroundColor: C.field, borderColor: C.fieldBorder, borderWidth: 1, borderRadius: R.sm, color: C.text, fontSize: 17, textAlign: 'center', paddingVertical: 8, fontFamily: 'monospace' },
  numDone: { backgroundColor: 'transparent', borderColor: 'transparent' },
  check: { width: 44, height: 44, borderRadius: R.sm, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: C.lime, borderColor: C.lime },
  addBtn: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#2a2a2a', borderRadius: R.lg, paddingVertical: 14, alignItems: 'center' },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  rest: { backgroundColor: '#151515', borderTopWidth: 1, borderTopColor: '#262626', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  restTrack: { height: 3, backgroundColor: '#262626', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  restFill: { height: '100%', backgroundColor: C.orange },
  pill: { backgroundColor: '#222', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, marginLeft: 6 },
  pillText: { color: '#ccc', fontSize: 13 },
})
