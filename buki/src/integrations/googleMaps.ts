import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import type { GeoPoint, PlaceAvailability, PlaceKind, TripLocation, TripPlan, TripPlace, TripStop, WalkingSegment } from '../types'

export interface GoogleMapsController {
  map: google.maps.Map
  directionsService: google.maps.DirectionsService
  directionsRenderer: google.maps.DirectionsRenderer
  markers: google.maps.Marker[]
}

interface NearbyCandidate {
  place: google.maps.places.Place
  kind: PlaceKind
}

interface RouteResult {
  segments: WalkingSegment[]
  warnings: string[]
}

let configuredKey = ''
let loadPromise: Promise<void> | null = null

const CATEGORY_TYPES: Record<PlaceKind, string[]> = {
  food: ['restaurant', 'cafe'],
  culture: ['museum', 'art_gallery'],
  view: ['tourist_attraction', 'park'],
}

const CATEGORY_LABELS: Record<PlaceKind, string> = {
  food: 'comida local',
  culture: 'cultura',
  view: 'paseo al aire libre',
}

export async function loadGoogleMaps(apiKey: string) {
  if (!apiKey) throw new Error('GOOGLE_MAPS_KEY_MISSING')
  if (configuredKey && configuredKey !== apiKey) {
    throw new Error('GOOGLE_MAPS_KEY_CHANGED')
  }

  if (!loadPromise) {
    configuredKey = apiKey
    setOptions({ key: apiKey, v: 'weekly', language: 'es' })
    loadPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('places'),
      importLibrary('routes'),
    ]).then(() => undefined)
  }

  await loadPromise
}

export async function createGoogleMap(
  container: HTMLElement,
  center: GeoPoint,
  apiKey: string,
): Promise<GoogleMapsController> {
  await loadGoogleMaps(apiKey)

  const map = new google.maps.Map(container, {
    center,
    zoom: 15,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: 'greedy',
  })

  const directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    preserveViewport: false,
    polylineOptions: {
      strokeColor: '#e56e47',
      strokeOpacity: 0.95,
      strokeWeight: 5,
    },
  })

  return {
    map,
    directionsService: new google.maps.DirectionsService(),
    directionsRenderer,
    markers: [],
  }
}

export function moveGoogleMap(controller: GoogleMapsController, center: GeoPoint) {
  controller.map.panTo(center)
}

export function updateGoogleMapMarkers(
  controller: GoogleMapsController,
  origin: TripLocation,
  stops: TripStop[],
) {
  controller.markers.forEach((marker) => marker.setMap(null))
  controller.markers = []

  if (origin.coordinates) {
    controller.markers.push(new google.maps.Marker({
      map: controller.map,
      position: origin.coordinates,
      title: origin.name,
      label: '●',
      zIndex: 10,
    }))
  }

  stops.forEach((stop) => {
    if (!stop.place.coordinates) return
    controller.markers.push(new google.maps.Marker({
      map: controller.map,
      position: stop.place.coordinates,
      title: stop.place.name,
      label: String(stop.sequence),
    }))
  })
}

async function findNearbyByKind(origin: GeoPoint, kind: PlaceKind): Promise<NearbyCandidate[]> {
  const { Place } = await importLibrary('places')
  const { SearchNearbyRankPreference } = await importLibrary('places')
  const response = await Place.searchNearby({
    fields: ['id', 'displayName', 'formattedAddress', 'location', 'googleMapsURI'],
    includedPrimaryTypes: CATEGORY_TYPES[kind],
    locationRestriction: { center: origin, radius: 1800 },
    maxResultCount: 3,
    rankPreference: SearchNearbyRankPreference.POPULARITY,
    language: 'es',
  })

  return response.places
    .filter((place) => Boolean(place.location))
    .map((place) => ({ place, kind }))
}

async function fetchPlaceDetails(candidate: NearbyCandidate): Promise<TripPlace | null> {
  const { place, kind } = candidate
  await place.fetchFields({
    fields: [
      'displayName',
      'formattedAddress',
      'location',
      'googleMapsURI',
      'businessStatus',
      'currentOpeningHours',
      'regularOpeningHours',
      'editorialSummary',
    ],
  })

  if (!place.location || !place.displayName) return null

  let isOpen: boolean | undefined
  try {
    isOpen = await place.isOpen()
  } catch {
    isOpen = undefined
  }

  const availability: PlaceAvailability = place.businessStatus === 'CLOSED_PERMANENTLY'
    ? 'closed'
    : isOpen === true
      ? 'open'
      : isOpen === false
        ? 'closed'
        : 'unknown'

  const availabilityLabel = place.businessStatus === 'CLOSED_PERMANENTLY'
    ? 'Cerrado permanentemente'
    : isOpen === true
      ? 'Abierto ahora'
      : isOpen === false
        ? 'Cerrado ahora'
        : 'Estado no disponible'

  return {
    id: place.id,
    name: place.displayName,
    kind,
    summary: place.editorialSummary ?? `Una opción de ${CATEGORY_LABELS[kind]} encontrada cerca de ti.`,
    address: place.formattedAddress ?? 'Dirección no disponible',
    availability,
    availabilityLabel,
    checkedAt: `Consultado ahora · ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`,
    x: 26 + (kind === 'food' ? 48 : kind === 'culture' ? 30 : 8),
    y: 36 + (kind === 'food' ? 0 : kind === 'culture' ? 28 : 48),
    coordinates: { lat: place.location.lat(), lng: place.location.lng() },
    mapsUrl: place.googleMapsURI ?? undefined,
  }
}

async function searchFinalPlaces(origin: GeoPoint): Promise<TripPlace[]> {
  const kinds: PlaceKind[] = ['food', 'culture', 'view']
  const candidateGroups = await Promise.all(
    kinds.map(async (kind) => {
      try {
        return await findNearbyByKind(origin, kind)
      } catch {
        return []
      }
    }),
  )

  const finalists = candidateGroups
    .map((candidates) => candidates[0])
    .filter((candidate): candidate is NearbyCandidate => Boolean(candidate))

  const places = await Promise.all(finalists.map(fetchPlaceDetails))
  return places.filter((place): place is TripPlace => Boolean(place))
}

async function drawWalkingRoute(
  controller: GoogleMapsController,
  origin: GeoPoint,
  places: TripPlace[],
): Promise<RouteResult> {
  const destinations = places.filter((place) => Boolean(place.coordinates))
  if (destinations.length === 0) throw new Error('GOOGLE_MAPS_NO_ROUTE_DESTINATIONS')

  const destination = destinations[destinations.length - 1].coordinates!
  const waypoints = destinations.slice(0, -1).map((place) => ({
    location: place.coordinates!,
    stopover: true,
  }))
  const response = await controller.directionsService.route({
    origin,
    destination,
    waypoints,
    optimizeWaypoints: false,
    travelMode: google.maps.TravelMode.WALKING,
    unitSystem: google.maps.UnitSystem.METRIC,
  })

  controller.directionsRenderer.setDirections(response)
  const route = response.routes[0]
  const legs = route?.legs ?? []
  const segments = destinations.map((place, index) => {
    const leg = legs[index]
    return {
      fromId: index === 0 ? 'origin' : destinations[index - 1].id,
      toId: place.id,
      minutes: Math.max(1, Math.round((leg?.duration?.value ?? 0) / 60)),
      meters: leg?.distance?.value ?? 0,
    }
  })

  return {
    segments,
    warnings: route?.warnings ?? [],
  }
}

export async function buildGoogleTripPlan(
  controller: GoogleMapsController,
  origin: TripLocation,
  title: string,
  city: string,
): Promise<TripPlan> {
  if (!origin.coordinates) throw new Error('GOOGLE_MAPS_ORIGIN_MISSING')

  const places = await searchFinalPlaces(origin.coordinates)
  if (places.length < 2) throw new Error('GOOGLE_MAPS_NOT_ENOUGH_PLACES')

  const route = await drawWalkingRoute(controller, origin.coordinates, places)
  const stops: TripStop[] = places.map((place, index) => ({
    id: place.id,
    sequence: index + 1,
    place,
    walkFromPrevious: route.segments[index] ?? {
      fromId: index === 0 ? origin.id : places[index - 1].id,
      toId: place.id,
      minutes: 0,
      meters: 0,
    },
  }))

  updateGoogleMapMarkers(controller, origin, stops)

  return {
    title,
    city,
    origin,
    totalWalkingMinutes: stops.reduce((sum, stop) => sum + stop.walkFromPrevious.minutes, 0),
    stops,
    source: 'google-maps',
    checkedAt: `Google Maps · ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`,
    routeWarnings: route.warnings,
  }
}
