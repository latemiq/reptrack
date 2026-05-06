import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local')
  process.exit(1)
}

const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

interface RawExercise {
  id: string
  name: string
  force: string | null
  level: 'beginner' | 'intermediate' | 'expert'
  mechanic: string | null
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  category: string
  images: string[]
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  console.log('⬇ Pobieram bazę z GitHuba...')
  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    console.error(`✗ Fetch failed: ${res.status} ${res.statusText}`)
    process.exit(1)
  }

  const exercises: RawExercise[] = await res.json()
  console.log(`✓ Pobrano ${exercises.length} ćwiczeń`)

  const rows = exercises.map(ex => ({
    catalog_id:        ex.id,
    name:              ex.name,
    source:            'catalog',
    user_id:           null,
    is_custom:         false,
    force:             ex.force,
    level:             ex.level,
    mechanic:          ex.mechanic,
    equipment:         ex.equipment,
    primary_muscles:   ex.primaryMuscles ?? [],
    secondary_muscles: ex.secondaryMuscles ?? [],
    instructions:      ex.instructions ?? [],
    category:          ex.category,
    images:            (ex.images ?? []).map((p: string) => IMAGE_BASE + p),
    muscle_group:      ex.primaryMuscles?.[0] ?? null,
  }))

  console.log('💾 Zapisuję do Supabase (upsert po catalog_id)...')

  const BATCH_SIZE = 100
  let inserted = 0
  let errors = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('exercises')
      .upsert(batch, { onConflict: 'catalog_id', ignoreDuplicates: false })

    if (error) {
      console.error(`✗ Batch ${i}-${i + batch.length}:`, error.message)
      errors++
    } else {
      inserted += batch.length
      process.stdout.write(`\r  ${inserted}/${rows.length}`)
    }
  }

  console.log(`\n\n✓ Gotowe! Zaimportowano ${inserted} ćwiczeń`)
  if (errors > 0) console.log(`⚠  Błędów: ${errors}`)

  const { count: totalCatalog } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'catalog')

  console.log(`📊 W bazie jest ${totalCatalog ?? 0} ćwiczeń z katalogu`)
}

main().catch(err => {
  console.error('✗ Błąd:', err)
  process.exit(1)
})
