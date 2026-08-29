import type {
  PlaceAlternative,
  TripLocation,
  TripPlan,
  TripPlace,
  TripStop,
} from '../types'

export const DEFAULT_INTENT =
  'I have the whole afternoon. I want to eat something local, visit two interesting places, and walk no more than twenty minutes between each stop.'

export const MOCK_LOCATIONS: TripLocation[] = [
  {
    id: 'plaza-armas',
    name: 'Plaza de Armas',
    detail: 'Santiago Center',
    x: 48,
    y: 53,
    coordinates: { lat: -33.4372, lng: -70.6506 },
  },
  {
    id: 'barrio-lastarria',
    name: 'Barrio Lastarria',
    detail: 'José Victorino Lastarria',
    x: 30,
    y: 68,
    coordinates: { lat: -33.4364, lng: -70.6396 },
  },
  {
    id: 'parque-forestal',
    name: 'Parque Forestal',
    detail: 'José María Caro Avenue',
    x: 25,
    y: 40,
    coordinates: { lat: -33.4334, lng: -70.6472 },
  },
]

const MOCK_STOPS: TripPlace[] = [
  {
    id: 'mercado-central',
    name: 'Mercado Central',
    kind: 'food',
    summary: 'A Chilean lunch to start with something local.',
    address: 'San Pablo 967',
    availability: 'open',
    availabilityLabel: 'Open now',
    checkedAt: 'Checked 2 min ago',
    x: 75,
    y: 35,
    coordinates: { lat: -33.4329, lng: -70.6527 },
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Mercado+Central+Santiago',
  },
  {
    id: 'museo-precolombino',
    name: 'Museo Chileno de Arte Precolombino',
    kind: 'culture',
    summary: 'A cultural pause featuring pieces from across the Americas.',
    address: 'Bandera 361',
    availability: 'closed',
    availabilityLabel: 'Closed today',
    checkedAt: 'Checked 2 min ago',
    x: 57,
    y: 70,
    coordinates: { lat: -33.4351, lng: -70.6505 },
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Museo+Chileno+de+Arte+Precolombino',
  },
  {
    id: 'cerro-santa-lucia',
    name: 'Cerro Santa Lucía',
    kind: 'view',
    summary: 'A scenic finish with viewpoints and a short walk.',
    address: 'Terraza Neptuno',
    availability: 'open',
    availabilityLabel: 'Open now',
    checkedAt: 'Checked 2 min ago',
    x: 29,
    y: 84,
    coordinates: { lat: -33.4375, lng: -70.6433 },
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cerro+Santa+Lucia+Santiago',
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
    title: 'An afternoon with local flavor',
    city: 'Santiago Center',
    origin,
    totalWalkingMinutes: legMinutes.reduce((sum, minutes) => sum + minutes, 0),
    stops,
    source: 'mock',
    checkedAt: 'Simulated data',
  }
}

export const MOCK_ALTERNATIVE: PlaceAlternative = {
  replacesStopId: 'museo-precolombino',
  place: {
    id: 'centro-cultural-la-moneda',
    name: 'Centro Cultural La Moneda',
    kind: 'culture',
    summary: 'A nearby cultural alternative that is still open.',
    address: 'Plaza de la Ciudadanía 26',
    availability: 'open',
    availabilityLabel: 'Open now',
    checkedAt: 'Checked 2 min ago',
    x: 61,
    y: 59,
    coordinates: { lat: -33.4421, lng: -70.6536 },
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Centro+Cultural+La+Moneda',
  },
  walkFromPrevious: {
    fromId: 'mercado-central',
    toId: 'centro-cultural-la-moneda',
    minutes: 7,
    meters: 550,
  },
  reason: 'Keeps the cultural interest while shortening the leg from the previous stop.',
}
