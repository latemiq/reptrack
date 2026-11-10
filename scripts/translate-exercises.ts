// One-off: translates the exercise atlas (names + instructions) to Polish with Claude
// and writes data/exercises-pl.json, keyed by catalog_id. /api/exercises merges it in.
//
//   npx tsx scripts/translate-exercises.ts            → translate what's missing
//   npx tsx scripts/translate-exercises.ts --limit=10 → small test run
//
// Resumable: entries already in the JSON file are skipped, and the file is saved
// after every batch, so an interrupted run can simply be started again.

import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

config({ path: '.env.local' })

const OUT = 'data/exercises-pl.json'
const BATCH = 20
const CONCURRENCY = 4
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : Infinity

type Translation = { name: string; instructions: string[] }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const client = new Anthropic()

const SYSTEM = `Tłumaczysz atlas ćwiczeń siłowych na polski dla aplikacji treningowej.
- Nazwy: tak, jak mówi się na polskiej siłowni, np. "Barbell Squat" → "Przysiad ze sztangą", "Bench Press" → "Wyciskanie sztangi na ławce poziomej", "Lat Pulldown" → "Ściąganie drążka wyciągu górnego", "Romanian Deadlift" → "Rumuński martwy ciąg". Zachowaj warianty z oryginału (chwyt, sprzęt, pozycja), żeby podobne ćwiczenia dały się odróżnić. Przyjęte zapożyczenia (np. "Hip thrust", "Face pull", "Good morning") możesz zostawić.
- Instrukcje: naturalna polszczyzna, tryb rozkazujący, w drugiej osobie ("Stań…", "Opuść…"), ta sama liczba kroków co w oryginale.
- Zwróć wynik dla każdego ćwiczenia z wejścia, z tym samym "id".`

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          instructions: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'name', 'instructions'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

async function translateBatch(rows: { catalog_id: string; name: string; instructions: string[] }[]) {
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    // Server-side fallback: if the model declines a batch, another model finishes it in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'low', format: jsonSchemaOutputFormat(SCHEMA) },
    messages: [{
      role: 'user',
      content: JSON.stringify(rows.map(r => ({ id: r.catalog_id, name: r.name, instructions: r.instructions }))),
    }],
  })
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw new Error(`batch not translated (stop_reason: ${response.stop_reason})`)
  }
  return { items: response.parsed_output.items, usage: response.usage }
}

async function main() {
  const done: Record<string, Translation> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

  const { data, error } = await supabase.from('exercises')
    .select('catalog_id, name, instructions').eq('source', 'catalog').order('name').range(0, 1999)
  if (error) throw error
  const todo = (data ?? []).filter(r => r.catalog_id && !done[r.catalog_id]).slice(0, LIMIT)
  console.log(`Atlas: ${data?.length} ćwiczeń, przetłumaczone: ${Object.keys(done).length}, do zrobienia: ${todo.length}`)

  const batches: typeof todo[] = []
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))

  mkdirSync('data', { recursive: true })
  let inTok = 0, outTok = 0, failed = 0, next = 0
  const save = () => writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(done).sort()), null, 1))

  const worker = async () => {
    while (next < batches.length) {
      const idx = next++
      const batch = batches[idx]
      try {
        const { items, usage } = await translateBatch(batch)
        inTok += usage.input_tokens; outTok += usage.output_tokens
        const ids = new Set(batch.map(b => b.catalog_id))
        for (const it of items) if (ids.has(it.id) && it.name.trim()) done[it.id] = { name: it.name.trim(), instructions: it.instructions }
        save()
        console.log(`  ✓ paczka ${idx + 1}/${batches.length} (${Object.keys(done).length} gotowe)`)
      } catch (e) {
        failed++
        console.error(`  ✗ paczka ${idx + 1}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker))

  // Opus 5.5 list price: $4 / $20 per million input / output tokens.
  const cost = (inTok * 4 + outTok * 20) / 1e6
  console.log(`\nGotowe: ${Object.keys(done).length} tłumaczeń · tokeny ${inTok} wej. / ${outTok} wyj. · ~$${cost.toFixed(2)}${failed ? ` · ${failed} paczek do ponowienia` : ''}`)
}

main().catch(e => { console.error(e); process.exit(1) })
