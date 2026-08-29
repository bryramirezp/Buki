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

function mockPlan(intent: string) {
  return {
    mode: 'mock',
    intent,
    status: 'ready',
    stops: [],
  }
}

export default function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Use POST /api/plan.' })
  }

  const input = (request.body ?? {}) as PlanInput
  if (typeof input.intent !== 'string' || input.intent.trim() === '') {
    return response.status(400).json({ error: 'intent is required.' })
  }

  if ((process.env.BUKI_MODE ?? 'mock') === 'mock') {
    return response.status(200).json(mockPlan(input.intent.trim()))
  }

  if (!process.env.LLM_API_KEY) {
    return response.status(500).json({ error: 'LLM_API_KEY is not configured.' })
  }

  return response.status(501).json({
    error: 'The provider-specific LLM adapter will be added after the provider contract is defined.',
  })
}
