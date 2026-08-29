export type Category =
  | 'flight'
  | 'transfer'
  | 'accommodation'
  | 'excursion'
  | 'meet_greet'

export type Status = 'ok' | 'cancelled' | 'broken' | 'at_risk' | 'repaired'

export interface ServiceLine {
  id: string
  day: number
  startsAt: string
  endsAt: string
  category: Category
  supplier: string
  location: string
  description: string
  pax: number
  price: number
  refundable: boolean
  status: Status
  dependsOn: string[]
}

export interface Alternative {
  id: string
  serviceId: string
  supplier: string
  description: string
  startsAt: string
  endsAt: string
  location: string
  price: number
  refundable: boolean
}

export interface ApprovalRequest {
  changes: Array<{ serviceId: string; from: ServiceLine; to: ServiceLine }>
  costDelta: number
  note: string
}

export type PlaceAvailability = 'open' | 'closed' | 'unknown'

export type PlaceKind = 'food' | 'culture' | 'view'

export interface TripLocation {
  id: string
  name: string
  detail: string
  x: number
  y: number
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
  x: number
  y: number
}

export interface WalkingSegment {
  fromId: string
  toId: string
  minutes: number
  meters: number
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
  stops: TripStop[]
}

export interface PlaceAlternative {
  replacesStopId: string
  place: TripPlace
  walkFromPrevious: WalkingSegment
  reason: string
}
