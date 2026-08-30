import type { GeoPoint, PlannerAnswers, PlannerResponse } from './types'

export function isPlannerResponse(value: unknown): value is PlannerResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  const preferences = candidate.preferences
  if (!preferences || typeof preferences !== 'object' || typeof candidate.intent !== 'string') return false
  const parsedPreferences = preferences as Record<string, unknown>
  if (candidate.mode === 'clarification') {
    return (
      (candidate.nextQuestion === 'duration' || candidate.nextQuestion === 'walking') &&
      (parsedPreferences.availableMinutes === undefined || typeof parsedPreferences.availableMinutes === 'number') &&
      (parsedPreferences.maxWalkMinutes === undefined || typeof parsedPreferences.maxWalkMinutes === 'number')
    )
  }
  const request = candidate.request
  if (!request || typeof request !== 'object') return false
  const parsedRequest = request as Record<string, unknown>
  return (
    candidate.mode === 'ready' &&
    typeof candidate.title === 'string' &&
    typeof candidate.explanation === 'string' &&
    typeof parsedPreferences.availableMinutes === 'number' &&
    typeof parsedPreferences.maxWalkMinutes === 'number' &&
    Array.isArray(parsedRequest.interests) &&
    typeof parsedRequest.availableMinutes === 'number' &&
    typeof parsedRequest.maxWalkMinutes === 'number' &&
    (parsedRequest.stopCount === 2 || parsedRequest.stopCount === 3)
  )
}

export function pointFromToolInput(input: Record<string, unknown>): GeoPoint | null {
  const latitude = input.latitude
  const longitude = input.longitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { lat: latitude, lng: longitude }
}

export function searchRadiusFromToolInput(input: Record<string, unknown>) {
  if (input.radiusMeters === undefined) return undefined
  const radiusMeters = input.radiusMeters
  if (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters) || radiusMeters < 100 || radiusMeters > 50000) {
    throw new Error('VALID_RADIUS_METERS_REQUIRED')
  }
  return Math.round(radiusMeters)
}

export function plannerAnswersFromToolInput(input: Record<string, unknown>): PlannerAnswers {
  const answers: PlannerAnswers = {}
  if (input.availableMinutes !== undefined) {
    if (typeof input.availableMinutes !== 'number' || !Number.isFinite(input.availableMinutes) || input.availableMinutes < 30 || input.availableMinutes > 720) {
      throw new Error('VALID_AVAILABLE_MINUTES_REQUIRED')
    }
    answers.availableMinutes = Math.round(input.availableMinutes)
  }
  if (input.maxWalkMinutes !== undefined) {
    if (typeof input.maxWalkMinutes !== 'number' || !Number.isFinite(input.maxWalkMinutes) || input.maxWalkMinutes < 5 || input.maxWalkMinutes > 90) {
      throw new Error('VALID_MAX_WALK_MINUTES_REQUIRED')
    }
    answers.maxWalkMinutes = Math.round(input.maxWalkMinutes)
  }
  return answers
}
