import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { anthropic, COACH_MODEL, FALLBACK_BETA } from '@/lib/anthropic'
import { getUserId } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ALL_CONTEXT, buildContextText, loadCoachData, type ContextKey } from '@/lib/coach-context'

export const maxDuration = 120

const SYSTEM_PROMPT = `Jesteś AI coachem treningowym w aplikacji RepTrack. Analizujesz dane użytkownika i dajesz konkretne, spersonalizowane rekomendacje po polsku.

Zasady:
- Bądź bezpośredni i konkretny. Gdy dane pozwalają na odpowiedź, odpowiedz wprost zamiast pisać "to zależy".
- Opieraj się na liczbach z danych użytkownika (podanych poniżej). Jeśli danych brakuje, powiedz czego brakuje i zaproponuj co zalogować — nie wymyślaj wartości.
- Rozumiesz zarówno bieganie jak i trening siłowy oraz ich wzajemny wpływ.
- Na frustrację reaguj empatycznie, ale rzeczowo.
- Formatowanie: krótkie akapity, **pogrubienie** dla kluczowych liczb, *kursywa* dla pojęć. Bez nagłówków markdown i tabel.
- Nie stawiasz diagnoz medycznych; przy bólu lub urazie odsyłasz do specjalisty.`

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ['running',  /bieg|tempo|km|maraton|półmaraton|interwał/i],
  ['diet',     /diet|kalor|jedzen|białk|deficyt|nadwyżk/i],
  ['recovery', /regenerac|deload|sen|odpoczyn|zmęcz|ból|kontuzj/i],
]

const detectCategory = (text: string) => CATEGORY_KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? 'gym'

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message || message.length > 4000) {
    return new Response('Invalid message', { status: 400 })
  }

  const contextKeys: ContextKey[] = Array.isArray(body?.context)
    ? body.context.filter((k: unknown): k is ContextKey => ALL_CONTEXT.includes(k as ContextKey))
    : ALL_CONTEXT

  const supabase = supabaseAdmin()

  // Resolve or create the conversation
  let conversationId: string | null = typeof body?.conversationId === 'string' ? body.conversationId : null
  let conversationTitle: string | null = null

  if (conversationId) {
    const { data: conv } = await supabase
      .from('coach_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!conv) conversationId = null
  }

  if (!conversationId) {
    conversationTitle = message.length > 60 ? `${message.slice(0, 57).trimEnd()}…` : message
    const { data: conv, error } = await supabase
      .from('coach_conversations')
      .insert({ user_id: userId, title: conversationTitle, category: detectCategory(message) })
      .select('id')
      .single()
    if (error || !conv) {
      console.error('Conversation insert error:', error)
      return new Response('Database error', { status: 500 })
    }
    conversationId = conv.id as string
  }

  const [{ data: historyRows }, coachData] = await Promise.all([
    supabase
      .from('coach_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20),
    loadCoachData(userId),
  ])

  const history: Anthropic.Beta.BetaMessageParam[] = (historyRows ?? [])
    .reverse()
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  // The API requires the first message to be from the user
  while (history.length && history[0].role !== 'user') history.shift()

  await supabase.from('coach_messages').insert({ conversation_id: conversationId, user_id: userId, role: 'user', content: message })

  const contextText = contextKeys.length > 0
    ? buildContextText(coachData, contextKeys)
    : 'Użytkownik wyłączył kontekst danych treningowych dla tej wiadomości.'

  const encoder = new TextEncoder()
  const send = (controller: ReadableStreamDefaultController, payload: object) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

  const readable = new ReadableStream({
    async start(controller) {
      send(controller, { type: 'conversation', id: conversationId, title: conversationTitle })
      let fullText = ''
      try {
        const stream = anthropic.beta.messages.stream({
          model: COACH_MODEL,
          max_tokens: 16000,
          output_config: { effort: 'low' },
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          system: [
            { type: 'text', text: SYSTEM_PROMPT },
            { type: 'text', text: `DANE UŻYTKOWNIKA:\n${contextText}` },
          ],
          messages: [...history, { role: 'user', content: message }],
        })

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text
            send(controller, { type: 'text', delta: event.delta.text })
          }
        }

        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal' && !fullText) {
          fullText = 'Nie mogę odpowiedzieć na to pytanie. Spróbuj sformułować je inaczej.'
          send(controller, { type: 'text', delta: fullText })
        }

        if (fullText) {
          await supabase.from('coach_messages').insert({ conversation_id: conversationId, user_id: userId, role: 'assistant', content: fullText })
        }
        await supabase.from('coach_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

        send(controller, { type: 'done' })
      } catch (e) {
        console.error('Coach stream error:', e)
        send(controller, { type: 'error', message: 'Coach jest chwilowo niedostępny. Spróbuj ponownie.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
