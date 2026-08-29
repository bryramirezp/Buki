import type {
  PlaceAlternative,
  TripLocation,
  TripPlan,
  TripPlace,
  TripStop,
} from '../types'

export const DEFAULT_INTENT =
  'Tengo toda la tarde, quiero comer algo típico, conocer dos lugares interesantes y caminar no más de veinte minutos entre cada parada.'

export const MOCK_LOCATIONS: TripLocation[] = [
  {
    id: 'plaza-armas',
    name: 'Plaza de Armas',
    detail: 'Centro de Santiago',
    x: 48,
    y: 53,
  },
  {
    id: 'barrio-lastarria',
    name: 'Barrio Lastarria',
    detail: 'José Victorino Lastarria',
    x: 30,
    y: 68,
  },
  {
    id: 'parque-forestal',
    name: 'Parque Forestal',
    detail: 'Avenida José María Caro',
    x: 25,
    y: 40,
  },
]

const MOCK_STOPS: TripPlace[] = [
  {
    id: 'mercado-central',
    name: 'Mercado Central',
    kind: 'food',
    summary: 'Un almuerzo chileno para empezar con algo local.',
    address: 'San Pablo 967',
    availability: 'open',
    availabilityLabel: 'Abierto ahora',
    checkedAt: 'Consultado hace 2 min',
    x: 75,
    y: 35,
  },
  {
    id: 'museo-precolombino',
    name: 'Museo Chileno de Arte Precolombino',
    kind: 'culture',
    summary: 'Una pausa cultural con piezas de toda América.',
    address: 'Bandera 361',
    availability: 'closed',
    availabilityLabel: 'Cerrado hoy',
    checkedAt: 'Consultado hace 2 min',
    x: 57,
    y: 70,
  },
  {
    id: 'cerro-santa-lucia',
    name: 'Cerro Santa Lucía',
    kind: 'view',
    summary: 'Un cierre con miradores y una caminata corta.',
    address: 'Terraza Neptuno',
    availability: 'open',
    availabilityLabel: 'Abierto ahora',
    checkedAt: 'Consultado hace 2 min',
    x: 29,
    y: 84,
  },
]

const FIRST_LEG_MINUTES: Record<string, number> = {
  'plaza-armas': 8,
  'barrio-lastarria': 6,
  'parque-forestal': 10,
}

const FIRST_LEG_METERS: Record<string, number> = {
  'plaza-armas': 650,
  'barrio-lastarria': 480,
  'parque-forestal': 780,
}

const findLocation = (locationId: string): TripLocation =>
  MOCK_LOCATIONS.find((location) => location.id === locationId) ?? MOCK_LOCATIONS[0]

export function getMockItinerary(originId = 'plaza-armas'): TripPlan {
  const origin = findLocation(originId)
  const legMinutes = [FIRST_LEG_MINUTES[origin.id] ?? 8, 11, 9]
  const legMeters = [FIRST_LEG_METERS[origin.id] ?? 650, 850, 700]

  const stops: TripStop[] = MOCK_STOPS.map((place, index) => ({
    id: place.id,
    sequence: index + 1,
    place,
    walkFromPrevious: {
      fromId: index === 0 ? origin.id : MOCK_STOPS[index - 1].id,
      toId: place.id,
      minutes: legMinutes[index],
      meters: legMeters[index],
    },
  }))

  return {
    title: 'Una tarde con sabor local',
    city: 'Santiago Centro',
    origin,
    totalWalkingMinutes: legMinutes.reduce((sum, minutes) => sum + minutes, 0),
    stops,
  }
}

export const MOCK_ALTERNATIVE: PlaceAlternative = {
  replacesStopId: 'museo-precolombino',
  place: {
    id: 'centro-cultural-la-moneda',
    name: 'Centro Cultural La Moneda',
    kind: 'culture',
    summary: 'Una alternativa cultural cercana que sigue abierta.',
    address: 'Plaza de la Ciudadanía 26',
    availability: 'open',
    availabilityLabel: 'Abierto ahora',
    checkedAt: 'Consultado hace 2 min',
    x: 61,
    y: 59,
  },
  walkFromPrevious: {
    fromId: 'mercado-central',
    toId: 'centro-cultural-la-moneda',
    minutes: 7,
    meters: 550,
  },
  reason: 'Conserva el interés cultural y reduce el tramo desde la parada anterior.',
}
