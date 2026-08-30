import type { TripPlace, TripRequest, WalkingSegment } from './types'

export interface RouteMetrics {
  segments: WalkingSegment[]
  warnings: string[]
}

export const STOP_DURATION_MINUTES = {
  food: 30,
  culture: 45,
  view: 15,
} as const

export const MAX_ROUTE_COMBINATIONS = 8

export function buildPlaceCombinations(
  places: TripPlace[],
  desiredStops: 2 | 3,
  maximumCombinations = MAX_ROUTE_COMBINATIONS,
) {
  const uniquePlaces = places.filter((place, index) => places.findIndex((candidate) => candidate.id === place.id) === index)
  const combinations: TripPlace[][] = []
  const seen = new Set<string>()
  let currentLimit = maximumCombinations

  const addCombination = (combination: TripPlace[]) => {
    const key = combination.map((place) => place.id).join('|')
    if (combination.length < 2 || seen.has(key) || combinations.length >= currentLimit) return
    seen.add(key)
    combinations.push(combination)
  }

  const stopCounts = desiredStops === 3 ? [3, 2] : [2]
  for (const [stopCountIndex, stopCount] of stopCounts.entries()) {
    const remainingGroups = stopCounts.length - stopCountIndex
    currentLimit = stopCountIndex === stopCounts.length - 1
      ? maximumCombinations
      : Math.min(maximumCombinations, combinations.length + Math.max(1, Math.floor((maximumCombinations - combinations.length) / remainingGroups)))
    for (let start = 0; start + stopCount <= uniquePlaces.length; start += 1) {
      addCombination(uniquePlaces.slice(start, start + stopCount))
    }

    const current: TripPlace[] = []
    const visit = (start: number) => {
      if (combinations.length >= currentLimit) return
      if (current.length === stopCount) {
        addCombination([...current])
        return
      }
      for (let index = start; index < uniquePlaces.length; index += 1) {
        current.push(uniquePlaces[index])
        visit(index + 1)
        current.pop()
      }
    }
    visit(0)
  }

  return combinations
}

export function assertRouteFitsRequest(route: RouteMetrics, places: TripPlace[], request?: TripRequest) {
  if (!request) return
  if (route.segments.some((segment) => segment.minutes > request.maxWalkMinutes)) {
    throw new Error('GOOGLE_MAPS_ROUTE_EXCEEDS_WALK_LIMIT')
  }
  const walkingMinutes = route.segments.reduce((total, segment) => total + segment.minutes, 0)
  const stopMinutes = places.reduce((total, place) => total + STOP_DURATION_MINUTES[place.kind], 0)
  if (walkingMinutes + stopMinutes > request.availableMinutes) {
    throw new Error('GOOGLE_MAPS_ROUTE_EXCEEDS_TIME_LIMIT')
  }
}

export async function findFittingPlaceRoute<TRoute extends RouteMetrics>(
  combinations: TripPlace[][],
  request: TripRequest | undefined,
  routeBuilder: (places: TripPlace[]) => Promise<TRoute>,
) {
  let walkLimitFailures = 0
  let timeLimitFailures = 0
  let routeError: unknown = null

  for (const places of combinations) {
    try {
      const route = await routeBuilder(places)
      assertRouteFitsRequest(route, places, request)
      return { places, route }
    } catch (error) {
      if (error instanceof Error && error.message === 'GOOGLE_MAPS_ROUTE_EXCEEDS_WALK_LIMIT') {
        walkLimitFailures += 1
      } else if (error instanceof Error && error.message === 'GOOGLE_MAPS_ROUTE_EXCEEDS_TIME_LIMIT') {
        timeLimitFailures += 1
      } else {
        routeError = error
      }
    }
  }

  if (walkLimitFailures || timeLimitFailures) {
    throw new Error(timeLimitFailures > walkLimitFailures
      ? 'GOOGLE_MAPS_ROUTE_EXCEEDS_TIME_LIMIT'
      : 'GOOGLE_MAPS_ROUTE_EXCEEDS_WALK_LIMIT')
  }
  if (routeError) throw routeError
  throw new Error('GOOGLE_MAPS_NO_ROUTE')
}
