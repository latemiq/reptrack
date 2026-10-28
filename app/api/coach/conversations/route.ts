import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserId, unauthorized } from '@/lib/api-auth'
import { loadCoachData } from '@/lib/coach-context'

export async function GET() {
  const userId = await getUserId()
  if (!userId) return unauthorized()

  const [{ data, error }, coachData] = await Promise.all([
    supabaseAdmin()
      .from('coach_conversations')
      .select('id, title, category, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50),
    loadCoachData(userId),
  ])

  if (error) {
    console.error('Conversations fetch error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({
    conversations: data ?? [],
    // counts for the context chips
    context: {
      workouts: coachData.workouts.length,
      runs:     coachData.runs.length,
      weights:  coachData.weights.length,
      goals:    coachData.goals.length,
    },
  })
}
