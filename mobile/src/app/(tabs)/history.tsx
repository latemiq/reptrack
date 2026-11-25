import Ionicons from '@expo/vector-icons/Ionicons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ErrorBox, Kicker, Loading } from '@/components/ui'
import { useApi } from '@/lib/api'
import { findPrs, fmtKg, fmtTonnes, mondayOf, timeAgo, type StatSet, type StatWorkout, type TemplateExercise } from '@/lib/gym'
import { C, R } from '@/lib/theme'
import { warmupLabel } from '@/lib/warmup'

interface Comment {
  id: string
  workoutId: string
  authorName: string
  authorRole: 'athlete' | 'trainer'
  mine: boolean
  body: string
  createdAt: string
}

const DAY = 86400000

function weekLabel(monday: number) {
  const thisMonday = mondayOf(new Date()).getTime()
  if (monday === thisMonday) return 'Ten tydzień'
  if (monday === thisMonday - 7 * DAY) return 'Poprzedni tydzień'
  const f = (t: number) => new Date(t).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
  return `${f(monday)} – ${f(monday + 6 * DAY)}`
}

function groupSets(sets: StatSet[]) {
  const groups = new Map<number, { id: string; name: string; sets: StatSet[] }>()
  for (const s of [...sets].sort((a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number)) {
    const g = groups.get(s.exercise_position) ?? { id: s.exercise_id, name: s.exercise_name ?? s.exercise_id, sets: [] }
    g.sets.push(s)
    groups.set(s.exercise_position, g)
  }
  return Array.from(groups.values())
}

/** A finished workout as template exercises: same sets, the most common reps, the heaviest weight. */
function templateFromWorkout(w: StatWorkout): TemplateExercise[] {
  return groupSets(w.workout_sets ?? []).map(g => {
    const reps = g.sets.map(s => s.reps ?? 0).filter(Boolean)
    const counts = new Map<number, number>()
    for (const r of reps) counts.set(r, (counts.get(r) ?? 0) + 1)
    const commonReps = Array.from(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 8
    const top = Math.max(0, ...g.sets.map(s => Number(s.weight_kg ?? 0)))
    return { exerciseId: g.id, name: g.name, targetSets: g.sets.length, targetReps: commonReps, targetWeight: top || null, restSeconds: 120 }
  })
}

/** "Zapisz jako szablon": a name field, then the workout becomes a template on the gym screen. */
function SaveAsTemplate({ workout }: { workout: StatWorkout }) {
  const api = useApi()
  const [name, setName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async () => {
    const clean = name?.trim()
    if (!clean) { setMessage({ ok: false, text: 'Wpisz nazwę szablonu.' }); return }
    setBusy(true)
    setMessage(null)
    try {
      const warmup = (workout.warmup ?? []).map(({ done: _done, ...w }) => w)
      await api('/api/gym/templates', { method: 'POST', body: JSON.stringify({ name: clean, exercises: templateFromWorkout(workout), warmup }) })
      setName(null)
      setMessage({ ok: true, text: `Zapisano szablon „${clean}”. Znajdziesz go na ekranie Trening.` })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Nie udało się zapisać szablonu.' })
    } finally { setBusy(false) }
  }

  return (
    <View style={{ gap: 8 }}>
      {name === null ? (
        <Pressable onPress={() => { setName(workout.name); setMessage(null) }} style={({ pressed }) => [st.tplBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="copy-outline" size={16} color={C.lime} />
          <Text style={{ color: C.lime, fontSize: 14 }}>Zapisz jako szablon</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          <TextInput value={name} onChangeText={setName} autoFocus placeholder="Nazwa szablonu" placeholderTextColor={C.textDim}
            maxLength={80} onSubmitEditing={save} returnKeyType="done" style={[st.input, { flex: 0 }]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={save} disabled={busy} style={[st.tplSave, busy && { opacity: 0.5 }]}>
              <Text style={{ color: C.limeDark, fontWeight: '700' }}>{busy ? 'Zapisuję…' : 'Zapisz szablon'}</Text>
            </Pressable>
            <Pressable onPress={() => setName(null)} style={st.tplCancel}><Text style={{ color: C.textDim }}>Anuluj</Text></Pressable>
          </View>
          <Text style={{ color: C.muted, fontSize: 12 }}>Te same ćwiczenia i liczba serii; powtórzenia i ciężar z tego treningu.</Text>
        </View>
      )}
      {!!message && <Text style={{ color: message.ok ? C.lime : C.danger, fontSize: 13 }}>{message.text}</Text>}
    </View>
  )
}

function Comments({ workoutId, comments, onChange }: { workoutId: string; comments: Comment[]; onChange: () => void }) {
  const api = useApi()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try {
      await api('/api/gym/comments', { method: 'POST', body: JSON.stringify({ workoutId, body: text }) })
      setText('')
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wysłać.')
    } finally { setBusy(false) }
  }

  const remove = (id: string) => Alert.alert('Usunąć komentarz?', undefined, [
    { text: 'Nie', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: async () => { await api(`/api/gym/comments?id=${id}`, { method: 'DELETE' }).catch(() => {}); onChange() } },
  ])

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 10, marginTop: 6, gap: 8 }}>
      <Kicker>Komentarze</Kicker>
      {comments.map(c => (
        <Pressable key={c.id} onLongPress={() => c.mine && remove(c.id)}
          style={[st.comment, c.authorRole === 'trainer' && { backgroundColor: C.limeTint, borderColor: C.limeLine }]}>
          <Text style={{ color: c.authorRole === 'trainer' ? C.lime : '#ccc', fontSize: 12, fontWeight: '700' }}>
            {c.mine ? 'Ty' : c.authorName}{c.authorRole === 'trainer' ? ' · trener' : ''}
            <Text style={{ color: C.faint, fontWeight: '400' }}>  {timeAgo(c.createdAt)}</Text>
          </Text>
          <Text style={{ color: '#ddd', fontSize: 14, marginTop: 2 }}>{c.body}</Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <TextInput value={text} onChangeText={setText} placeholder="Odpowiedz trenerowi…" placeholderTextColor="#444" multiline maxLength={2000}
          style={st.input} />
        <Pressable onPress={send} disabled={busy || !text.trim()} style={[st.send, (busy || !text.trim()) && { opacity: 0.4 }]}>
          <Ionicons name="send" size={18} color={C.limeDark} />
        </Pressable>
      </View>
      {!!error && <Text style={{ color: C.danger, fontSize: 12 }}>{error}</Text>}
    </View>
  )
}

/** History: month summary, workouts grouped by week with PRs and the trainer conversation. */
export default function History() {
  const api = useApi()
  const [workouts, setWorkouts] = useState<StatWorkout[] | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [available, setAvailable] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const loadComments = useCallback(async (list: StatWorkout[]) => {
    if (!list.length) return
    try {
      const d = await api<{ available: boolean; comments: Record<string, Comment[]> }>(`/api/gym/comments?workouts=${list.map(w => w.id).join(',')}`)
      setAvailable(d.available)
      setComments(d.comments)
    } catch { /* comments are optional */ }
  }, [api])

  const load = useCallback(async () => {
    setError('')
    try {
      const d = await api<{ workouts: StatWorkout[] }>('/api/gym/workouts?limit=100')
      setWorkouts(d.workouts)
      setOpenId(id => id ?? d.workouts[0]?.id ?? null)
      loadComments(d.workouts)
    } catch (e) {
      setWorkouts(ws => ws ?? [])
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać historii.')
    }
  }, [api, loadComments])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const prs = useMemo(() => findPrs(workouts ?? []), [workouts])
  const weeks = useMemo(() => {
    const g = new Map<number, StatWorkout[]>()
    for (const w of workouts ?? []) {
      const m = mondayOf(new Date(w.started_at)).getTime()
      g.set(m, [...(g.get(m) ?? []), w])
    }
    return Array.from(g.entries()).sort((a, b) => b[0] - a[0])
  }, [workouts])

  const month = useMemo(() => {
    const since = Date.now() - 30 * DAY
    const recent = (workouts ?? []).filter(w => new Date(w.started_at).getTime() >= since)
    return {
      count: recent.length,
      tonnage: recent.reduce((s, w) => s + Number(w.total_tonnage ?? 0), 0),
      minutes: Math.round(recent.reduce((s, w) => s + (w.duration_seconds ?? 0), 0) / 60),
    }
  }, [workouts])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.lime} colors={[C.lime]} progressBackgroundColor={C.card}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}>
        <Kicker>Siłownia</Kicker>
        <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', marginTop: -6 }}>Historia</Text>

        <View style={st.summary}>
          {[[String(month.count), 'treningi'], [fmtTonnes(month.tonnage), 'tonaż'], [`${Math.floor(month.minutes / 60)} h ${month.minutes % 60} min`, 'czas']].map(([v, l]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{v}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>{l} · 30 dni</Text>
            </View>
          ))}
        </View>

        <ErrorBox message={error} />
        {workouts === null && <Loading />}
        {workouts?.length === 0 && !error && <Text style={{ color: C.muted, textAlign: 'center', paddingVertical: 32 }}>Brak treningów. Zacznij pierwszy na ekranie Trening.</Text>}

        {weeks.map(([monday, list]) => (
          <View key={monday} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Kicker>{weekLabel(monday)}</Kicker>
              <Text style={{ color: C.faint, fontSize: 11 }}>{list.length} · {fmtTonnes(list.reduce((s, w) => s + Number(w.total_tonnage ?? 0), 0))}</Text>
            </View>
            {list.map(w => {
              const open = openId === w.id
              const groups = groupSets(w.workout_sets ?? [])
              const prCount = groups.filter(g => prs.has(`${w.id}:${g.id}`)).length
              const nComments = comments[w.id]?.length ?? 0
              return (
                <View key={w.id} style={[st.card, open && { borderColor: C.limeLine }]}>
                  <Pressable onPress={() => setOpenId(open ? null : w.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{w.name}</Text>
                        {prCount > 0 && <Text style={st.badge}>{prCount} PR</Text>}
                        {nComments > 0 && <Text style={[st.badge, { backgroundColor: '#1a1a1a', color: '#bbb' }]}>💬 {nComments}</Text>}
                      </View>
                      <Text style={{ color: C.muted, fontSize: 12 }}>
                        {new Date(w.started_at).toLocaleDateString('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit' })} · {Math.round((w.duration_seconds ?? 0) / 60)} min · {fmtTonnes(Number(w.total_tonnage ?? 0))}
                      </Text>
                    </View>
                    <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={16} color={C.faint} />
                  </Pressable>
                  {open && (
                    <View style={{ marginTop: 10, gap: 10 }}>
                      {!!w.warmup?.length && (
                        <View style={st.warmup}>
                          <Text style={{ color: C.orange, fontSize: 11, letterSpacing: 1.5, fontFamily: 'monospace' }}>ROZGRZEWKA</Text>
                          {w.warmup.map((x, i) => (
                            <Text key={i} style={{ color: C.textDim, fontSize: 13 }}>{warmupLabel(x)}</Text>
                          ))}
                        </View>
                      )}
                      {groups.map(g => (
                        <View key={`${g.id}-${g.sets[0]?.exercise_position}`}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: C.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{g.name}</Text>
                            {prs.has(`${w.id}:${g.id}`) && <Text style={{ color: C.lime, marginLeft: 6 }}>▲</Text>}
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {g.sets.map(s => (
                              <Text key={s.set_number} style={st.chip}>
                                {s.weight_kg != null ? `${fmtKg(Number(s.weight_kg))}×` : ''}{s.reps ?? '?'}
                              </Text>
                            ))}
                          </View>
                        </View>
                      ))}
                      {groups.length > 0 && <SaveAsTemplate workout={w} />}
                      {available && <Comments workoutId={w.id} comments={comments[w.id] ?? []} onChange={() => loadComments(workouts ?? [])} />}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const st = StyleSheet.create({
  summary: { flexDirection: 'row', backgroundColor: C.card, borderColor: C.cardBorder, borderWidth: 1, borderRadius: R.lg, paddingVertical: 14 },
  card: { backgroundColor: C.card, borderColor: C.cardBorder, borderWidth: 1, borderRadius: R.lg, padding: 14 },
  badge: { color: C.lime, backgroundColor: '#2a3a08', fontSize: 11, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  chip: { color: '#aaa', fontSize: 12, fontFamily: 'monospace', backgroundColor: C.field, borderColor: C.cardBorder, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  comment: { backgroundColor: C.field, borderColor: C.cardBorder, borderWidth: 1, borderRadius: R.md, padding: 10 },
  input: { flex: 1, backgroundColor: C.field, borderColor: C.fieldBorder, borderWidth: 1, borderRadius: R.md, color: C.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 120 },
  warmup: { borderWidth: 1, borderColor: 'rgba(245,160,58,0.25)', borderRadius: R.md, padding: 10, gap: 2 },
  tplBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.limeLine, borderRadius: R.md, paddingVertical: 10 },
  tplSave: { flex: 1, backgroundColor: C.lime, borderRadius: R.md, paddingVertical: 11, alignItems: 'center' },
  tplCancel: { paddingHorizontal: 16, borderRadius: R.md, borderWidth: 1, borderColor: C.fieldBorder, justifyContent: 'center' },
  send: { width: 44, height: 44, borderRadius: R.md, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
})
