import type { PlaceKind, TripRequest } from '../src/types'

type RequestLike = {
  method?: string
  body?: unknown
}

type ResponseLike = {
  status: (code: number) => ResponseLike
  json: (body: unknown) => void
}

type PlanInput = {
  intent?: unknown
}

type LlmPayload = {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

const DEFAULT_INTERESTS: PlaceKind[] = ['food', 'culture', 'view']
const ALLOWED_INTERESTS = new Set<PlaceKind>(DEFAULT_INTERESTS)

function clampNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

function parseJson(content: string): Record<string, unknown> {
  const normalized = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = normalized.indexOf('{')
  const end = normalized.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('LLM_INVALID_JSON')
  const parsed: unknown = JSON.parse(normalized.slice(start, end + 1))
  if (!parsed || typeof parsed !== 'object') throw new Error('LLM_INVALID_JSON')
  return parsed as Record<string, unknown>
}

function normalizePlannerResponse(intent: string, value: Record<string, unknown>) {
  const interests = Array.isArray(value.interests)
    ? value.interests.filter((item): item is PlaceKind => typeof item === 'string' && ALLOWED_INTERESTS.has(item as PlaceKind))
    : []
  const request: TripRequest = {
    interests: interests.length ? [...new Set(interests)] : DEFAULT_INTERESTS,
    availableMinutes: clampNumber(value.availableMinutes, 180, 30, 720),
    maxWalkMinutes: clampNumber(value.maxWalkMinutes, 20, 5, 45),
    stopCount: value.stopCount === 2 ? 2 : 3,
  }

  return {
    mode: 'llm',
    intent,
    title: typeof value.title === 'string' && value.title.trim()
      ? value.title.trim().slice(0, 80)
      : 'A route to explore now',
    explanation: typeof value.explanation === 'string' && value.explanation.trim()
      ? value.explanation.trim().slice(0, 240)
      : 'I will use your interests and walking limits to build a route with real places.',
    request,
  }
}

function contentFromLlm(payload: LlmPayload) {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== 'object') return ''
        const text = (part as { text?: unknown }).text
        return typeof text === 'string' ? text : ''
      })
      .join('')
  }
  return ''
}

function chatCompletionsUrl(value: string) {
  const baseUrl = value.trim().replace(/\/+$/, '')
  return baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
}

async function createLlmPlan(intent: string) {
  const apiKey = process.env.LLM_API_KEY?.trim()
  const apiUrl = process.env.LLM_API_URL?.trim()
  const model = process.env.LLM_MODEL?.trim()
  if (!apiKey) throw new Error('LLM_API_KEY is not configured.')
  if (!apiUrl) throw new Error('LLM_API_URL is not configured.')
  if (!model) throw new Error('LLM_MODEL is not configured.')

  const providerResponse = await fetch(chatCompletionsUrl(apiUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Buki',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: [
            'You are Buki\'s trip-intent parser.',
            'Return only valid JSON with exactly these keys: title, explanation, interests, availableMinutes, maxWalkMinutes, stopCount.',
            'interests must use only food, culture, or view.',
            'stopCount must be 2 or 3. Use defaults of 180 minutes, 20 walking minutes, and 3 stops when the user does not specify them.',
            'Do not invent place names, addresses, opening hours, distances, coordinates, or geographic facts.',
            'The frontend will obtain geographic truth from Google Maps.',
          ].join(' '),
        },
        { role: 'user', content: intent },
      ],
    }),
  })

  if (!providerResponse.ok) {
    throw new Error(`The LLM provider returned HTTP ${providerResponse.status}.`)
  }

  const payload = await providerResponse.json() as LlmPayload
  const content = contentFromLlm(payload)
  if (!content) throw new Error('The LLM provider returned no planning content.')
  return normalizePlannerResponse(intent, parseJson(content))
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Use POST /api/plan.' })
  }

  const input = (request.body ?? {}) as PlanInput
  if (typeof input.intent !== 'string' || input.intent.trim() === '') {
    return response.status(400).json({ error: 'intent is required.' })
  }

  if ((process.env.BUKI_MODE ?? 'real') !== 'real') {
    return response.status(503).json({ error: 'LLM planning is disabled. Set BUKI_MODE=real.' })
  }

  try {
    return response.status(200).json(await createLlmPlan(input.intent.trim()))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The LLM planner failed.'
    return response.status(502).json({ error: message })
  }
}
