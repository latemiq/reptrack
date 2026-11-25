import Ionicons from '@expo/vector-icons/Ionicons'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { C, R } from '@/lib/theme'
import { CARDIO_MACHINES, WARMUP_EXERCISES, warmupLabel, type WarmupItem } from '@/lib/warmup'
import { useWorkout } from '@/lib/workout-store'

const parse = (t: string) => { const n = Number(t.replace(',', '.')); return t.trim() === '' || Number.isNaN(n) ? null : n }
const show = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))

/** Warm-up at the top of the live workout: cardio machines and light exercises, ticked off like sets. */
export function WarmupSection() {
  // Select the stored array itself: a fresh `[]` from the selector would re-render forever.
  const stored = useWorkout(s => s.workout?.warmup)
  const items = stored ?? []
  const { addWarmup, updateWarmup, removeWarmup } = useWorkout()
  const [adding, setAdding] = useState<null | 'menu' | 'exercise'>(null)
  const [name, setName] = useState('')

  const addCardio = (machine: string) => {
    addWarmup({ kind: 'cardio', machine, minutes: 5, distanceKm: null, level: '' })
    setAdding(null)
  }
  const addExercise = (n: string) => {
    if (!n.trim()) return
    addWarmup({ kind: 'exercise', name: n.trim(), sets: 2, reps: 15 })
    setName('')
    setAdding(null)
  }
  const doneCount = items.filter(i => i.done).length

  return (
    <View style={st.card}>
      <View style={st.head}>
        <Ionicons name="flame-outline" size={16} color={C.orange} />
        <Text style={st.title}>Rozgrzewka</Text>
        <Text style={st.meta}>{items.length ? `${doneCount}/${items.length} · nie liczy się do serii` : 'nie liczy się do serii'}</Text>
      </View>

      {items.map((item, i) => (
        <View key={i} style={[st.item, item.done && { borderColor: 'rgba(245,160,58,0.35)' }]}>
          <View style={st.itemHead}>
            <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); updateWarmup(i, { done: !item.done }) }} hitSlop={8}
              accessibilityRole="checkbox" accessibilityState={{ checked: !!item.done }} accessibilityLabel={`Zaliczone: ${warmupLabel(item)}`}
              style={[st.check, item.done && st.checkOn]}>
              {item.done && <Ionicons name="checkmark" size={16} color={C.orangeDark} />}
            </Pressable>
            <Text style={[st.name, item.done && { color: C.textDim }]} numberOfLines={1}>{item.kind === 'cardio' ? item.machine : item.name}</Text>
            <Pressable onPress={() => removeWarmup(i)} hitSlop={8} accessibilityLabel={`Usuń ${item.kind === 'cardio' ? item.machine : item.name}`}>
              <Ionicons name="close" size={18} color={C.faint} />
            </Pressable>
          </View>
          {item.kind === 'cardio' ? (
            <View style={st.fields}>
              <Field label="min" value={show(item.minutes)} width={56} numeric onChange={t => updateWarmup(i, { minutes: parse(t) })} />
              <Field label="km" value={show(item.distanceKm)} width={64} numeric onChange={t => updateWarmup(i, { distanceKm: parse(t) })} />
              <Field label="tempo / poziom" value={item.level} flex placeholder="6 km/h, poziom 8" onChange={t => updateWarmup(i, { level: t })} />
            </View>
          ) : (
            <View style={st.fields}>
              <Field label="serie" value={show(item.sets)} width={56} numeric onChange={t => updateWarmup(i, { sets: Math.max(1, Math.round(parse(t) ?? 1)) })} />
              <Text style={{ color: C.muted, alignSelf: 'flex-end', paddingBottom: 10 }}>×</Text>
              <Field label="powt. / s" value={show(item.reps)} width={72} numeric onChange={t => updateWarmup(i, { reps: parse(t) })} />
            </View>
          )}
        </View>
      ))}

      {adding === null && (
        <Pressable onPress={() => setAdding('menu')} style={st.addBtn}>
          <Text style={{ color: C.orange, fontSize: 14 }}>+ Dodaj rozgrzewkę</Text>
        </Pressable>
      )}

      {adding === 'menu' && (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={st.label}>CARDIO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
            {CARDIO_MACHINES.map(m => (
              <Pressable key={m} onPress={() => addCardio(m)} style={st.chip}><Text style={st.chipText}>{m}</Text></Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => setAdding('exercise')} style={st.addBtn}>
            <Text style={{ color: C.orange, fontSize: 14 }}>+ Ćwiczenie na dogrzanie partii</Text>
          </Pressable>
          <Pressable onPress={() => setAdding(null)} style={{ paddingVertical: 6 }}><Text style={{ color: C.muted, textAlign: 'center' }}>Anuluj</Text></Pressable>
        </View>
      )}

      {adding === 'exercise' && (
        <View style={{ gap: 6, marginTop: 8 }}>
          <TextInput value={name} onChangeText={setName} autoFocus placeholder="Nazwa albo wybierz poniżej" placeholderTextColor={C.textDim}
            onSubmitEditing={() => addExercise(name)} returnKeyType="done" style={st.input} />
          {!!name.trim() && (
            <Pressable onPress={() => addExercise(name)} style={st.suggestion}><Text style={{ color: C.orange }}>+ Dodaj „{name.trim()}”</Text></Pressable>
          )}
          {WARMUP_EXERCISES.map(g => (
            <View key={g.group}>
              <Text style={st.label}>{g.group.toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {g.names.filter(n => !name.trim() || n.toLowerCase().includes(name.trim().toLowerCase())).map(n => (
                  <Pressable key={n} onPress={() => addExercise(n)} style={st.chip}><Text style={st.chipText}>{n}</Text></Pressable>
                ))}
              </View>
            </View>
          ))}
          <Pressable onPress={() => { setAdding(null); setName('') }} style={{ paddingVertical: 8 }}><Text style={{ color: C.muted, textAlign: 'center' }}>Anuluj</Text></Pressable>
        </View>
      )}
    </View>
  )
}

function Field({ label, value, onChange, width, flex, numeric, placeholder }: {
  label: string; value: string; onChange: (t: string) => void; width?: number; flex?: boolean; numeric?: boolean; placeholder?: string
}) {
  return (
    <View style={[{ gap: 3 }, flex ? { flex: 1 } : { width }]}>
      <Text style={st.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} placeholder={placeholder}
        placeholderTextColor={C.faint} style={[st.input, numeric && { textAlign: 'center' }]} />
    </View>
  )
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderColor: C.cardBorder, borderWidth: 1, borderRadius: R.lg, padding: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: C.text, fontSize: 15, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12, marginLeft: 'auto' },
  item: { borderWidth: 1, borderColor: C.fieldBorder, borderRadius: R.md, padding: 10, gap: 8 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: C.text, fontSize: 14, flex: 1 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.fieldBorder, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.orange, borderColor: C.orange },
  fields: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  fieldLabel: { color: C.muted, fontSize: 11 },
  input: { backgroundColor: C.field, borderColor: C.fieldBorder, borderWidth: 1, borderRadius: R.sm, color: C.text, fontSize: 15, paddingHorizontal: 8, paddingVertical: 8 },
  addBtn: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(245,160,58,0.4)', borderRadius: R.md, paddingVertical: 11, alignItems: 'center' },
  label: { color: C.muted, fontSize: 11, letterSpacing: 1.5, fontFamily: 'monospace' },
  chip: { borderWidth: 1, borderColor: C.fieldBorder, backgroundColor: C.field, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: C.text, fontSize: 13 },
  suggestion: { paddingVertical: 8 },
})
