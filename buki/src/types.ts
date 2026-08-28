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
