import { describe, expect, it } from 'vitest'
import { buildPlaceCombinations, findFittingPlaceRoute, type RouteMetrics } from './routePlanning'
import type { PlaceKind, TripPlace, TripRequest } from './types'

function place(id: string, kind: PlaceKind): TripPlace {
  return {
    id,
    name: id,
    kind,
    summary: '',
    address: '',
    availability: 'open',
    availabilityLabel: 'Open now',
    checkedAt: '2026-08-30T00:00:00.000Z',
    coordinates: { lat: 0, lng: 0 },
  }
}

function routeFor(places: TripPlace[], minutes: number): RouteMetrics {
  return {
    segments: places.map((candidate, index) => ({
      fromId: index === 0 ? 'origin' : places[index - 1].id,
      toId: candidate.id,
      minutes,
      meters: minutes * 80,
    })),
    warnings: [],
  }
}

describe('route planning without Google Maps', () => {
  it('builds alternative place combinations and reserves attempts for a shorter fallback', () => {
    const places = [
      place('food-1', 'food'),
      place('culture-1', 'culture'),
      place('view-1', 'view'),
      place('food-2', 'food'),
      place('culture-2', 'culture'),
    ]

    const combinations = buildPlaceCombinations(places, 3, 8)

    expect(combinations.some((combination) => combination.map(({ id }) => id).join(',') === 'food-1,culture-1,view-1')).toBe(true)
    expect(combinations.some((combination) => !combination.some(({ id }) => id === 'food-1'))).toBe(true)
    expect(combinations.some((combination) => combination.length === 2)).toBe(true)
  })

  it('tries another place combination before rejecting the chosen walking limit', async () => {
    const request: TripRequest = {
      interests: ['food', 'culture', 'view'],
      availableMinutes: 180,
      maxWalkMinutes: 20,
      stopCount: 3,
    }
    const first = [place('food-1', 'food'), place('culture-1', 'culture'), place('view-1', 'view')]
    const second = [place('food-2', 'food'), place('culture-2', 'culture'), place('view-2', 'view')]
    const attempts: string[] = []

    const result = await findFittingPlaceRoute([first, second], request, async (places) => {
      attempts.push(places[0].id)
      return routeFor(places, places === first ? 25 : 10)
    })

    expect(attempts).toEqual(['food-1', 'food-2'])
    expect(result.places).toBe(second)
  })
})
