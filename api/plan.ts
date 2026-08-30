import type {
  PlaceKind,
  PlannerAnswers,
  PlannerPreferences,
  PlannerResponse,
  TripRequest,
} from '../src/types'

type RequestLike = {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
  socket?: {
    remoteAddress?: string
  }
}

type ResponseLike = {
  status: (code: number) => ResponseLike
  json: (body: unknown) => void
  setHeader?: (name: string, value: string) => void
}

type PlanInput = {
  intent?: unknown
  answers?: unknown
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
const MAX_INTENT_CHARACTERS = 500
const MAX_BODY_CHARACTERS = 4096
const DEFAULT_RATE_LIMIT_MAX = 12
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

interface RateLimitWindow {
  count: number
  startedAt: number
}

const rateLimitWindows = new Map<string, RateLimitWindow>()

function requestHeader(request: RequestLike, name: string) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function configuredAllowedOrigins() {
  return (process.env.BUKI_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

function isAllowedOrigin(request: RequestLike) {
  const origin = requestHeader(request, 'origin')?.replace(/\/+$/, '')
  if (!origin) return true

  const configured = configuredAllowedOrigins()
  if (configured.length) return configured.includes(origin)

  const host = requestHeader(request, 'x-forwarded-host') ?? requestHeader(request, 'host')
  if (!host) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function requestClientKey(request: RequestLike) {
  const forwardedFor = requestHeader(request, 'x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || requestHeader(request, 'x-real-ip') || request.socket?.remoteAddress || 'unknown-client'
}

function takeRateLimitSlot(clientKey: string, now = Date.now()) {
  const maxRequests = positiveInteger(process.env.BUKI_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX)
  const windowMs = positiveInteger(process.env.BUKI_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS)
  const current = rateLimitWindows.get(clientKey)

  if (!current || now - current.startedAt >= windowMs) {
    rateLimitWindows.set(clientKey, { count: 1, startedAt: now })
    return { allowed: true, retryAfterSeconds: 0 }
  }
  if (current.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000)),
    }
  }

  current.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

export function resetPlanRateLimitsForTests() {
  rateLimitWindows.clear()
}

function clampOptionalNumber(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
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

function normalizeAnswers(value: unknown): PlannerAnswers {
  if (!value || typeof value !== 'object') return {}
  const candidate = value as Record<string, unknown>
  const duration = typeof candidate.duration === 'string' ? candidate.duration.trim().slice(0, 120) : undefined
  const walking = typeof candidate.walking === 'string' ? candidate.walking.trim().slice(0, 120) : undefined
  return {
    availableMinutes: clampOptionalNumber(candidate.availableMinutes, 30, 720),
    maxWalkMinutes: clampOptionalNumber(candidate.maxWalkMinutes, 5, 90),
    ...(duration ? { duration } : {}),
    ...(walking ? { walking } : {}),
  }
}

function getPlannerPreferences(value: Record<string, unknown>, answers: PlannerAnswers): PlannerPreferences {
  return {
    availableMinutes: answers.availableMinutes ?? clampOptionalNumber(value.availableMinutes, 30, 720),
    maxWalkMinutes: answers.maxWalkMinutes ?? clampOptionalNumber(value.maxWalkMinutes, 5, 90),
  }
}

export function normalizePlannerResponse(
  intent: string,
  answers: PlannerAnswers,
  value: Record<string, unknown>,
): PlannerResponse {
  const interests = Array.isArray(value.interests)
    ? value.interests.filter((item): item is PlaceKind => typeof item === 'string' && ALLOWED_INTERESTS.has(item as PlaceKind))
    : []
  const preferences = getPlannerPreferences(value, answers)
  if (preferences.availableMinutes === undefined) {
    return {
      mode: 'clarification',
      intent,
      preferences,
      nextQuestion: 'duration',
    }
  }
  if (preferences.maxWalkMinutes === undefined) {
    return {
      mode: 'clarification',
      intent,
      preferences,
      nextQuestion: 'walking',
    }
  }

  const request: TripRequest = {
    interests: interests.length ? [...new Set(interests)] : DEFAULT_INTERESTS,
    availableMinutes: preferences.availableMinutes,
    maxWalkMinutes: preferences.maxWalkMinutes,
    stopCount: value.stopCount === 2 || preferences.availableMinutes <= 90 ? 2 : 3,
  }

  return {
    mode: 'ready',
    intent,
    title: typeof value.title === 'string' && value.title.trim()
      ? value.title.trim().slice(0, 80)
      : 'A route to explore now',
    explanation: typeof value.explanation === 'string' && value.explanation.trim()
      ? value.explanation.trim().slice(0, 240)
      : 'I will use your interests and walking limits to build a route with real places.',
    preferences: {
      availableMinutes: preferences.availableMinutes,
      maxWalkMinutes: preferences.maxWalkMinutes,
    },
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

async function createLlmPlan(intent: string, answers: PlannerAnswers) {
  const apiKey = process.env.LLM_API_KEY?.trim()
  const apiUrl = process.env.LLM_API_URL?.trim()
  const model = process.env.LLM_MODEL?.trim()
  const fallbackModel = process.env.LLM_FALLBACK_MODEL?.trim()
  if (!apiKey) throw new Error('LLM_API_KEY is not configured.')
  if (!apiUrl) throw new Error('LLM_API_URL is not configured.')
  if (!model) throw new Error('LLM_MODEL is not configured.')

  const models = [...new Set([model, fallbackModel].filter((candidate): candidate is string => Boolean(candidate)))]
  let lastError: unknown

  for (const candidate of models) {
    try {
      const providerResponse = await fetch(chatCompletionsUrl(apiUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Buki',
        },
        body: JSON.stringify({
          model: candidate,
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: [
                'You are Buki\'s trip-intent parser.',
                'Return only valid JSON with exactly these keys: title, explanation, interests, availableMinutes, maxWalkMinutes, stopCount.',
                'interests must use only food, culture, or view.',
                'stopCount must be 2 or 3.',
                'Infer availableMinutes and maxWalkMinutes only when the person explicitly provides them in the intent or answers.',
                'Use null for either field when it is missing or ambiguous. Never guess, default, or invent a duration or walking limit.',
                'Do not invent place names, addresses, opening hours, distances, coordinates, or geographic facts.',
                'The frontend will obtain geographic truth from Google Maps.',
              ].join(' '),
            },
            {
              role: 'user',
              content: `Intent: ${intent}\nKnown answers from the person: ${JSON.stringify(answers)}`,
            },
          ],
        }),
      })

      if (!providerResponse.ok) {
        throw new Error(`The LLM provider returned HTTP ${providerResponse.status}.`)
      }

      const payload = await providerResponse.json() as LlmPayload
      const content = contentFromLlm(payload)
      if (!content) throw new Error('The LLM provider returned no planning content.')
      return normalizePlannerResponse(intent, answers, parseJson(content))
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('The LLM planner failed.')
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Use POST /api/plan.' })
  }

  const contentType = requestHeader(request, 'content-type')
  if (contentType && !contentType.toLowerCase().startsWith('application/json')) {
    return response.status(415).json({ error: 'Content-Type must be application/json.' })
  }

  if (!isAllowedOrigin(request)) {
    return response.status(403).json({ error: 'This origin is not allowed.' })
  }

  let bodyCharacters = 0
  try {
    bodyCharacters = JSON.stringify(request.body ?? {}).length
  } catch {
    return response.status(400).json({ error: 'Request body must be valid JSON.' })
  }
  if (bodyCharacters > MAX_BODY_CHARACTERS) {
    return response.status(413).json({ error: 'Request body is too large.' })
  }

  const input = (request.body ?? {}) as PlanInput
  if (typeof input.intent !== 'string' || input.intent.trim() === '') {
    return response.status(400).json({ error: 'intent is required.' })
  }
  const intent = input.intent.trim()
  if (intent.length > MAX_INTENT_CHARACTERS) {
    return response.status(400).json({ error: `intent must be ${MAX_INTENT_CHARACTERS} characters or fewer.` })
  }

  if ((process.env.BUKI_MODE ?? 'real') !== 'real') {
    return response.status(503).json({ error: 'LLM planning is disabled. Set BUKI_MODE=real.' })
  }

  const rateLimit = takeRateLimitSlot(requestClientKey(request))
  if (!rateLimit.allowed) {
    response.setHeader?.('Retry-After', String(rateLimit.retryAfterSeconds))
    return response.status(429).json({ error: 'Too many planning requests. Please try again shortly.' })
  }

  try {
    return response.status(200).json(await createLlmPlan(intent, normalizeAnswers(input.answers)))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The LLM planner failed.'
    return response.status(502).json({ error: message })
  }
}
