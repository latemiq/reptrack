import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const COACH_MODEL = 'claude-opus-5-5'

/** Server-side refusal fallback: on a policy decline the API retries on a fallback model. */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
