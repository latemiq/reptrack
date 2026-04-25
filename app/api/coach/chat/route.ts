import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `Jesteś AI coachem treningowym RepTrack. Analizujesz dane użytkownika i dajesz konkretne, spersonalizowane rekomendacje po polsku.

ZASADY:
- Jesteś bezpośredni – żadnego ogólnego "to zależy od wielu czynników"
- Używasz konkretnych liczb z danych użytkownika
- Rozumiesz zarówno bieganie jak i trening siłowy
- Reagujesz na frustracje empatycznie ale rzeczowo
- Używasz Markdown: **bold** dla kluczowych liczb, *italic* dla pojęć`

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { conversationId, message, context } = await req.json()

    if (typeof message !== 'string' || message.length > 4000) {
      return new Response('Invalid message', { status: 400 })
    }

    // TODO: fetch user data from Supabase based on context array
    // const userData = await fetchUserContext(userId, context)
    void conversationId
    void context

    // TODO: fetch conversation history from Supabase
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = []

    const stream = await anthropic.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        ...history,
        { role: 'user', content: message },
      ],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const data = JSON.stringify({ type: 'text', delta: event.delta.text })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()

          // TODO: save full response to Supabase
        } catch (e) {
          controller.error(e)
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
  } catch (e) {
    console.error('Coach API error:', e)
    return new Response('Internal error', { status: 500 })
  }
}
