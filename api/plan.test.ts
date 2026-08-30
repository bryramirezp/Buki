import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler, { normalizePlannerResponse, resetPlanRateLimitsForTests } from './plan'

const parsedIntent = {
  title: 'A relaxed local afternoon',
  explanation: 'A route with real places.',
  interests: ['food', 'view'],
  stopCount: 3,
}

const TEST_ENVIRONMENT = [
  'BUKI_MODE',
  'BUKI_ALLOWED_ORIGINS',
  'BUKI_RATE_LIMIT_MAX',
  'BUKI_RATE_LIMIT_WINDOW_MS',
  'LLM_API_KEY',
  'LLM_API_URL',
  'LLM_MODEL',
  'LLM_FALLBACK_MODEL',
] as const
const originalEnvironment = Object.fromEntries(TEST_ENVIRONMENT.map((name) => [name, process.env[name]]))

async function callPlan(request: {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  socket?: { remoteAddress?: string }
}) {
  let statusCode = 200
  let body: unknown
  const headers: Record<string, string> = {}
  const response = {
    status(code: number) {
      statusCode = code
      return response
    },
    setHeader(name: string, value: string) {
      headers[name] = value
    },
    json(value: unknown) {
      body = value
    },
  }

  await handler(request, response)
  return { statusCode, body, headers }
}

beforeEach(() => {
  resetPlanRateLimitsForTests()
  process.env.BUKI_MODE = 'real'
  process.env.BUKI_ALLOWED_ORIGINS = 'https://buki.example'
  process.env.BUKI_RATE_LIMIT_MAX = '12'
  process.env.BUKI_RATE_LIMIT_WINDOW_MS = '600000'
  process.env.LLM_API_KEY = 'test-key'
  process.env.LLM_API_URL = 'https://llm.example/v1'
  process.env.LLM_MODEL = 'test-model'
  delete process.env.LLM_FALLBACK_MODEL
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            ...parsedIntent,
            availableMinutes: 120,
            maxWalkMinutes: 20,
          }),
        },
      }],
    }),
  }) as Response))
})

afterEach(() => {
  resetPlanRateLimitsForTests()
  vi.unstubAllGlobals()
  for (const name of TEST_ENVIRONMENT) {
    const value = originalEnvironment[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('Buki planner clarification contract', () => {
  it('asks for duration instead of applying a hidden default', () => {
    const response = normalizePlannerResponse('I want food and a park', {}, parsedIntent)

    expect(response).toEqual({
      mode: 'clarification',
      intent: 'I want food and a park',
      preferences: {},
      nextQuestion: 'duration',
    })
  })

  it('asks about walking only after duration is known', () => {
    const response = normalizePlannerResponse('I want food and a park', { availableMinutes: 120 }, parsedIntent)

    expect(response).toEqual({
      mode: 'clarification',
      intent: 'I want food and a park',
      preferences: { availableMinutes: 120 },
      nextQuestion: 'walking',
    })
  })

  it('becomes ready only when the person has supplied both constraints', () => {
    const response = normalizePlannerResponse(
      'I want food and a park',
      { availableMinutes: 120, maxWalkMinutes: 20 },
      parsedIntent,
    )

    expect(response).toMatchObject({
      mode: 'ready',
      preferences: { availableMinutes: 120, maxWalkMinutes: 20 },
      request: {
        interests: ['food', 'view'],
        availableMinutes: 120,
        maxWalkMinutes: 20,
        stopCount: 3,
      },
    })
  })
})

describe('Buki planning endpoint safeguards', () => {
  const allowedHeaders = {
    'content-type': 'application/json',
    origin: 'https://buki.example',
    'x-forwarded-for': '203.0.113.12',
  }

  it('rejects requests from an unexpected browser origin before calling the provider', async () => {
    const result = await callPlan({
      method: 'POST',
      body: { intent: 'A short cultural walk' },
      headers: { ...allowedHeaders, origin: 'https://attacker.example' },
    })

    expect(result).toMatchObject({
      statusCode: 403,
      body: { error: 'This origin is not allowed.' },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects oversized intent before calling the provider', async () => {
    const result = await callPlan({
      method: 'POST',
      body: { intent: 'x'.repeat(501) },
      headers: allowedHeaders,
    })

    expect(result).toMatchObject({
      statusCode: 400,
      body: { error: 'intent must be 500 characters or fewer.' },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires JSON requests before calling the provider', async () => {
    const result = await callPlan({
      method: 'POST',
      body: { intent: 'A short walk' },
      headers: { ...allowedHeaders, 'content-type': 'text/plain' },
    })

    expect(result).toMatchObject({
      statusCode: 415,
      body: { error: 'Content-Type must be application/json.' },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('limits repeated planning calls from the same client', async () => {
    process.env.BUKI_RATE_LIMIT_MAX = '1'
    const request = {
      method: 'POST',
      body: { intent: 'Food and a park', answers: { availableMinutes: 120, maxWalkMinutes: 20 } },
      headers: allowedHeaders,
    }

    const first = await callPlan(request)
    const second = await callPlan(request)

    expect(first.statusCode).toBe(200)
    expect(second).toMatchObject({
      statusCode: 429,
      body: { error: 'Too many planning requests. Please try again shortly.' },
    })
    expect(Number(second.headers['Retry-After'])).toBeGreaterThan(0)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries the configured fallback model when the primary provider request fails', async () => {
    process.env.LLM_MODEL = 'primary-model'
    process.env.LLM_FALLBACK_MODEL = 'fallback-model'
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
      const request = JSON.parse(String(options?.body)) as { model: string }
      if (request.model === 'primary-model') {
        return { ok: false, status: 429 } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                ...parsedIntent,
                availableMinutes: 120,
                maxWalkMinutes: 20,
              }),
            },
          }],
        }),
      } as Response
    }))

    const result = await callPlan({
      method: 'POST',
      body: { intent: 'Food and a park', answers: { availableMinutes: 120, maxWalkMinutes: 20 } },
      headers: allowedHeaders,
    })

    expect(result.statusCode).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toMatchObject({ model: 'fallback-model' })
  })
})
