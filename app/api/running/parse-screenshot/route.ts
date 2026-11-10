import { NextRequest, NextResponse } from 'next/server'
import { anthropic, COACH_MODEL, FALLBACK_BETA } from '@/lib/anthropic'
import { getUserId, unauthorized } from '@/lib/api-auth'

export const maxDuration = 30

const numberOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const sourceOrOther = (value: unknown) =>
  value === 'garmin' || value === 'strava' || value === 'apple_fitness' || value === 'other'
    ? value
    : 'other'

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  try {
    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'Brak obrazka' }, { status: 400 })
    }
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(mimeType)) {
      return NextResponse.json({ error: 'Nieobsługiwany format obrazka' }, { status: 400 })
    }

    const message = await anthropic.beta.messages.create({
      model: COACH_MODEL,
      max_tokens: 4096,
      output_config: { effort: 'low' },
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Analizuj ten screenshot z aplikacji fitnessowej (Garmin Connect, Strava, Apple Fitness lub podobna) i wyciągnij dane biegu.

Zwróć WYŁĄCZNIE poprawny JSON bez markdown, w tym formacie:
{
  "distance_km": number | null,
  "duration_seconds": number | null,
  "avg_pace_seconds_per_km": number | null,
  "avg_hr": number | null,
  "max_hr": number | null,
  "elevation_gain_m": number | null,
  "calories": number | null,
  "date": "YYYY-MM-DD" | null,
  "source_app": "garmin" | "strava" | "apple_fitness" | "other"
}

Zasady:
- Czas w sekundach (np. 1:04:28 → 3868)
- Tempo w sekundach na km (np. 5:12 /km → 312)
- Jeśli nie znajdujesz wartości → null
- Nie zgaduj. Lepiej null niż błędna wartość.
- Jeśli screenshot nie pokazuje biegu (inny sport, inna treść) → wszystkie wartości null oraz source_app="other".`,
          },
        ],
      }],
    })

    if (message.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'AI odmówiło analizy tego obrazka' }, { status: 422 })
    }

    const text = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
    const cleaned = text.replace(/```json|```/g, '').trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({
        error: 'AI zwróciło nieparsowalne dane',
        raw: cleaned.slice(0, 500),
      }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      data: {
        distance_km: numberOrNull(parsed.distance_km),
        duration_seconds: numberOrNull(parsed.duration_seconds),
        avg_pace_seconds_per_km: numberOrNull(parsed.avg_pace_seconds_per_km),
        avg_hr: numberOrNull(parsed.avg_hr),
        max_hr: numberOrNull(parsed.max_hr),
        elevation_gain_m: numberOrNull(parsed.elevation_gain_m),
        calories: numberOrNull(parsed.calories),
        date: typeof parsed.date === 'string' ? parsed.date : null,
        source_app: sourceOrOther(parsed.source_app),
      },
    })
  } catch (e) {
    console.error('Parse-screenshot error:', e)
    return NextResponse.json({
      // Library errors are English and technical — log them, show a plain Polish message.
      error: 'Nie udało się odczytać zrzutu ekranu. Spróbuj ponownie albo wpisz bieg ręcznie.',
    }, { status: 500 })
  }
}
