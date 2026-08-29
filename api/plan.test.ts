import { describe, expect, it } from 'vitest'
import { normalizePlannerResponse } from './plan'

const parsedIntent = {
  title: 'A relaxed local afternoon',
  explanation: 'A route with real places.',
  interests: ['food', 'view'],
  stopCount: 3,
}

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
