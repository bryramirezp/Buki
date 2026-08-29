export type PlaceAvailability = 'open' | 'closed' | 'unknown'

export type PlaceKind = 'food' | 'culture' | 'view'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface TripRequest {
  interests: PlaceKind[]
  availableMinutes: number
  maxWalkMinutes: number
  stopCount: 2 | 3
  searchRadiusMeters?: number
}

export type PlannerQuestion = 'duration' | 'walking'

export interface PlannerAnswers {
  availableMinutes?: number
  maxWalkMinutes?: number
  duration?: string
  walking?: string
}

export interface PlannerPreferences {
  availableMinutes?: number
  maxWalkMinutes?: number
}

export interface PlannerClarificationResponse {
  mode: 'clarification'
  intent: string
  preferences: PlannerPreferences
  nextQuestion: PlannerQuestion
}

export interface PlannerReadyResponse {
  mode: 'ready'
  intent: string
  title: string
  explanation: string
  preferences: Required<PlannerPreferences>
  request: TripRequest
}

export type PlannerResponse = PlannerClarificationResponse | PlannerReadyResponse

export interface TripLocation {
  id: string
  name: string
  detail: string
  coordinates: GeoPoint
}

export interface TripPlace {
  id: string
  name: string
  kind: PlaceKind
  summary: string
  address: string
  availability: PlaceAvailability
  availabilityLabel: string
  checkedAt: string
  coordinates: GeoPoint
  mapsUrl?: string
}

export interface WalkingSegment {
  fromId: string
  toId: string
  minutes: number
  meters: number
  warning?: string
}

export interface TripStop {
  id: string
  sequence: number
  place: TripPlace
  walkFromPrevious: WalkingSegment
}

export interface TripPlan {
  title: string
  city: string
  origin: TripLocation
  totalWalkingMinutes: number
  totalEstimatedMinutes: number
  stops: TripStop[]
  source: 'google-maps'
  checkedAt: string
  routeWarnings?: string[]
}
