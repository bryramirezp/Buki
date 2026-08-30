import { afterEach, describe, expect, it, vi } from 'vitest'
import planHandler, { resetPlanRateLimitsForTests } from '../api/plan'
import {
  activeStopIdAfterReplacement,
  activeStopIdAfterUndo,
  advanceProgress,
  firstProgressStopId,
} from './plannerState'
import { buildPlaceCombinations, findFittingPlaceRoute, type RouteMetrics } from './routePlanning'
import type { PlannerReadyResponse, TripLocation, TripPlace, TripPlan, TripStop } from './types'

const originalEnvironment = Object.fromEntries(
  ['BUKI_MODE', 'LLM_API_KEY', 'LLM_API_URL', 'LLM_MODEL', 'LLM_FALLBACK_MODEL'].map((name) => [name, process.env[name]]),
)

const origin: TripLocation = {
  id: 'origin',
  name: 'Test origin',
  detail: 'Test city',
  coordinates: { lat: 0, lng: 0 },
}

function place(id: string): TripPlace {
  return {
    id,
    name: id,
    kind: 'culture',
    summary: `${id} summary`,
    address: `${id} address`,
    availability: 'open',
    availabilityLabel: 'Open now',
    checkedAt: '2026-08-30T00:00:00.000Z',
    coordinates: { lat: 0, lng: 0 },
  }
}

function routeFor(places: TripPlace[], minutes: number): RouteMetrics {
  return {
    warnings: [],
    segments: places.map((candidate, index) => ({
      fromId: index === 0 ? origin.id : places[index - 1].id,
      toId: candidate.id,
      minutes,
      meters: minutes * 80,
    })),
  }
}

function planFrom(places: TripPlace[], route: RouteMetrics): TripPlan {
  const stops: TripStop[] = places.map((candidate, index) => ({
    id: candidate.id,
    sequence: index + 1,
    place: candidate,
    walkFromPrevious: route.segments[index],
  }))
  return {
    title: 'A quiet cultural walk',
    city: 'Test city',
    origin,
    totalWalkingMinutes: route.segments.reduce((total, segment) => total + segment.minutes, 0),
    totalEstimatedMinutes: route.segments.reduce((total, segment) => total + segment.minutes, 0) + places.length * 45,
    stops,
    source: 'google-maps',
    checkedAt: '2026-08-30T00:00:00.000Z',
  }
}

async function callPlan() {
  let statusCode = 200
  let body: unknown
  const response = {
    status(code: number) {
      statusCode = code
      return response
    },
    json(value: unknown) {
      body = value
    },
  }
  await planHandler({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: {
      intent: 'A quiet cultural walk',
      answers: { availableMinutes: 180, maxWalkMinutes: 20 },
    },
  }, response)
  return { statusCode, body }
}

afterEach(() => {
  resetPlanRateLimitsForTests()
  vi.unstubAllGlobals()
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('simulated planning flow', () => {
  it('completes the happy path with simulated LLM and Maps responses', async () => {
    process.env.BUKI_MODE = 'real'
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_API_URL = 'https://llm.example/v1'
    process.env.LLM_MODEL = 'primary-model'
    delete process.env.LLM_FALLBACK_MODEL
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'A quiet cultural walk',
              explanation: 'Culture near the selected starting point.',
              interests: ['culture'],
              availableMinutes: 180,
              maxWalkMinutes: 20,
              stopCount: 2,
            }),
          },
        }],
      }),
    }) as Response))

    const llm = await callPlan()
    expect(llm.statusCode).toBe(200)
    const planner = llm.body as PlannerReadyResponse
    const candidates = [place('museum-1'), place('museum-2'), place('museum-3')]
    const mapResult = await findFittingPlaceRoute(
      buildPlaceCombinations(candidates, planner.request.stopCount),
      planner.request,
      async (selection) => routeFor(selection, selection[0].id === 'museum-1' ? 25 : 10),
    )
    const itinerary = planFrom(mapResult.places, mapResult.route)
    const activeStopId = firstProgressStopId(itinerary.stops)

    expect(mapResult.places.map((candidate) => candidate.id)).toEqual(['museum-2', 'museum-3'])
    expect(advanceProgress(itinerary.stops, activeStopId)).toMatchObject({
      status: 'ok',
      activeStopId: 'museum-3',
    })
  })

  it('accepts and undoes a simulated Maps repair without losing active-stop identity', () => {
    const initial = planFrom([place('museum-1'), place('museum-2')], routeFor([place('museum-1'), place('museum-2')], 10))
    const replacement = place('museum-replacement')
    const repaired = planFrom([replacement, initial.stops[1].place], routeFor([replacement, initial.stops[1].place], 8))
    const activeAfterRepair = activeStopIdAfterReplacement(
      'museum-1',
      'museum-1',
      replacement.id,
      repaired.stops,
    )

    expect(activeAfterRepair).toBe('museum-replacement')
    expect(activeStopIdAfterUndo(
      activeAfterRepair,
      'museum-1',
      replacement.id,
      initial.stops,
    )).toBe('museum-1')
    expect(repaired.totalWalkingMinutes).toBe(16)
  })
})
