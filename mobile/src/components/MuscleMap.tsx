import { type ComponentType, type Ref, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview'
import { Card, Kicker } from '@/components/ui'
import { API_URL } from '@/lib/api'
import { C, R } from '@/lib/theme'

/** Response of GET /api/gym/muscles. */
export interface MuscleWeek {
  weekStart: string
  workouts: number
  totalSets: number
  groups: Record<string, { sets: number; exercises: { name: string; sets: number; primary: boolean }[] }>
  unknown: string[]
}

// Muscle groups as named in the exercise database and the 3D model.
export const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Klatka', shoulders: 'Barki', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Przedramiona',
  abdominals: 'Brzuch', lats: 'Najszersze grzbietu', 'middle back': 'Środek pleców', traps: 'Kaptury',
  'lower back': 'Dolny grzbiet', neck: 'Szyja', glutes: 'Pośladki', quadriceps: 'Czworogłowe uda',
  hamstrings: 'Dwugłowe uda', adductors: 'Przywodziciele', abductors: 'Odwodziciele', calves: 'Łydki',
}
// Big groups worth flagging when skipped (neck, forearms and the hip muscles are left out).
const MAIN = ['chest', 'shoulders', 'biceps', 'triceps', 'abdominals', 'lats', 'middle back', 'lower back', 'glutes', 'quadriceps', 'hamstrings', 'calves']

// Same thresholds and colours as public/muscle-map/index.html.
const LEGEND: [string, string][] = [['0', '#34322f'], ['1–5', '#3f4d17'], ['6–9', '#7a9922'], ['10+', '#c8f53a']]

const fmtSets = (n: number) => String(n).replace('.', ',')
const setsWord = (n: number) => {
  if (!Number.isInteger(n)) return 'serii'
  if (n === 1) return 'seria'
  const d = n % 10, t = n % 100
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? 'serie' : 'serii'
}

// The package types WebView as a plain function component, but it does take a ref.
interface WebViewHandle { injectJavaScript(js: string): void }
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>

const VIEWER = `${API_URL}/muscle-map/index.html?bg=111111`

/** Weekly 3D muscle map: groups trained this week light up in lime, more sets = brighter. */
export function MuscleMap({ data }: { data: MuscleWeek | null }) {
  const web = useRef<WebViewHandle>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const sets = useMemo(
    () => Object.fromEntries(Object.entries(data?.groups ?? {}).map(([g, v]) => [g, v.sets])),
    [data],
  )

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.setMuscles(${JSON.stringify(sets)});true;`)
  }, [ready, sets])

  const send = (js: string) => web.current?.injectJavaScript(`${js};true;`)

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'ready') setReady(true)
      if (msg.type === 'error') setFailed(true)
      if (msg.type === 'select') setSelected(msg.group ?? null)
    } catch { /* ignore */ }
  }

  const ranked = useMemo(
    () => Object.entries(data?.groups ?? {}).filter(([g]) => MUSCLE_LABEL[g]).sort((a, b) => b[1].sets - a[1].sets),
    [data],
  )
  const skipped = MAIN.filter(g => !(data?.groups[g]?.sets))
  const sel = selected ? data?.groups[selected] : null

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={st.head}>
        <View>
          <Kicker>Mięśnie w tym tygodniu</Kicker>
          <Text style={st.sub}>
            {data ? `${data.totalSets} ${setsWord(data.totalSets)} · ${ranked.length} ${ranked.length === 1 ? 'partia' : 'partii'}` : '…'}
          </Text>
        </View>
        <View style={st.views}>
          {([['front', 'Przód'], ['back', 'Tył'], ['spin', '↻']] as const).map(([v, label]) => (
            <Pressable key={v} onPress={() => send(`window.setView('${v}')`)} style={({ pressed }) => [st.viewBtn, pressed && { opacity: 0.6 }]}>
              <Text style={st.viewTxt}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={st.stage}>
        {failed
          ? <Text style={st.fail}>Nie udało się wczytać modelu 3D. Sprawdź internet.</Text>
          : (
            <WebView
              ref={web}
              source={{ uri: VIEWER }}
              onMessage={onMessage}
              onError={() => setFailed(true)}
              style={{ backgroundColor: C.card }}
              containerStyle={{ backgroundColor: C.card }}
              scrollEnabled={false}
              nestedScrollEnabled
              overScrollMode="never"
              setBuiltInZoomControls={false}
              javaScriptEnabled
              originWhitelist={['*']}
            />
          )}
      </View>

      <View style={st.legend}>
        {LEGEND.map(([label, color]) => (
          <View key={label} style={st.legendItem}>
            <View style={[st.swatch, { backgroundColor: color }]} />
            <Text style={st.legendTxt}>{label}</Text>
          </View>
        ))}
        <Text style={st.legendTxt}>serii</Text>
      </View>

      <View style={st.body}>
        {selected ? (
          <View style={st.detail}>
            <View style={st.detailHead}>
              <Text style={st.detailName}>{MUSCLE_LABEL[selected] ?? selected}</Text>
              <Text style={[st.detailSets, !sel && { color: C.muted }]}>{fmtSets(sel?.sets ?? 0)} {setsWord(sel?.sets ?? 0)}</Text>
            </View>
            {sel ? sel.exercises.map(e => (
              <Text key={e.name} style={st.exercise} numberOfLines={1}>
                {e.name} · {e.sets} {setsWord(e.sets)}{e.primary ? '' : ' (pomocniczo)'}
              </Text>
            )) : <Text style={st.exercise}>Nietrenowane w tym tygodniu</Text>}
          </View>
        ) : (
          <Text style={st.hint}>Dotknij mięśnia, żeby zobaczyć ćwiczenia. Przeciągnij, żeby obrócić.</Text>
        )}

        {ranked.slice(0, 6).map(([g, v]) => (
          <Pressable key={g} style={st.row} onPress={() => { setSelected(g); send(`window.selectGroup(${JSON.stringify(g)})`) }}>
            <Text style={st.rowName} numberOfLines={1}>{MUSCLE_LABEL[g]}</Text>
            <View style={st.bar}><View style={[st.fill, { width: `${Math.min(100, (v.sets / 12) * 100)}%` }]} /></View>
            <Text style={st.rowSets}>{fmtSets(v.sets)}</Text>
          </Pressable>
        ))}

        {!!data && skipped.length > 0 && (
          <Text style={st.skipped}>
            <Text style={{ color: C.textDim }}>Pominięte: </Text>{skipped.map(g => MUSCLE_LABEL[g].toLowerCase()).join(', ')}
          </Text>
        )}
        <Text style={st.credit}>Model 3D: Z-Anatomy · CC BY-SA 4.0</Text>
      </View>
    </Card>
  )
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 4 },
  sub: { color: C.textDim, fontSize: 13, marginTop: 4 },
  views: { flexDirection: 'row', gap: 6 },
  viewBtn: { borderWidth: 1, borderColor: C.fieldBorder, backgroundColor: C.field, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6 },
  viewTxt: { color: C.textDim, fontSize: 12 },
  stage: { height: 420, backgroundColor: C.card, justifyContent: 'center' },
  fail: { color: C.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  legend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendTxt: { color: C.muted, fontSize: 11 },
  body: { paddingHorizontal: 16, paddingBottom: 14 },
  hint: { color: C.muted, fontSize: 12, marginBottom: 8 },
  detail: { backgroundColor: C.field, borderWidth: 1, borderColor: C.fieldBorder, borderRadius: R.md, padding: 12, marginBottom: 10, gap: 3 },
  detailHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  detailName: { color: C.text, fontSize: 15, fontWeight: '700' },
  detailSets: { color: C.lime, fontSize: 15, fontWeight: '700' },
  exercise: { color: C.textDim, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  rowName: { color: C.text, fontSize: 13, width: 130 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#1a1a1a', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: C.lime },
  rowSets: { color: C.textDim, fontSize: 12, width: 28, textAlign: 'right' },
  skipped: { color: C.muted, fontSize: 12, marginTop: 8 },
  credit: { color: C.faint, fontSize: 10, marginTop: 10, textAlign: 'center' },
})
