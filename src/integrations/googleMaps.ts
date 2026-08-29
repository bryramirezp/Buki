import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import type { GeoPoint, PlaceAvailability, PlaceKind, TripLocation, TripPlan, TripPlace, TripRequest, TripStop, WalkingSegment } from '../types'

export interface GoogleMapsController {
  map: google.maps.Map
  routePolylines: google.maps.Polyline[]
  markers: google.maps.marker.AdvancedMarkerElement[]
}

export interface GoogleMapAddress {
  name: string
  detail: string
}

interface NearbyCandidate {
  place: google.maps.places.Place
  kind: PlaceKind
}

interface RouteResult {
  segments: WalkingSegment[]
  warnings: string[]
  route: google.maps.routes.Route
}

export type GoogleMapProgress =
  | 'Searching nearby places'
  | 'Checking nearby place details'
  | 'Calculating a walkable route'
  | 'Adding the route to your map'

let configuredKey = ''
let loadPromise: Promise<void> | null = null

const CATEGORY_TYPES: Record<PlaceKind, string[]> = {
  food: ['restaurant', 'cafe'],
  culture: ['museum', 'art_gallery'],
  view: ['tourist_attraction', 'park'],
}

const CATEGORY_LABELS: Record<PlaceKind, string> = {
  food: 'local food',
  culture: 'culture',
  view: 'outdoor activity',
}

const STOP_DURATION_MINUTES: Record<PlaceKind, number> = {
  food: 30,
  culture: 45,
  view: 15,
}

const DEFAULT_SEARCH_RADIUS_METERS = 1800

export const MINIMUM_MAP_ZOOM = 3
export const MAXIMUM_MAP_ZOOM = 20
export const BUKI_MAP_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 85,
  south: -85,
  east: 180,
  west: -180,
}

export function createBukiMapOptions(center: GeoPoint, mapId: string, zoom = 15): google.maps.MapOptions {
  return {
    center,
    zoom: Math.max(MINIMUM_MAP_ZOOM, Math.min(MAXIMUM_MAP_ZOOM, zoom)),
    mapId: mapId || 'DEMO_MAP_ID',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
    keyboardShortcuts: true,
    minZoom: MINIMUM_MAP_ZOOM,
    maxZoom: MAXIMUM_MAP_ZOOM,
    restriction: {
      latLngBounds: BUKI_MAP_BOUNDS,
      strictBounds: true,
    },
  }
}

export async function loadGoogleMaps(apiKey: string) {
  if (!apiKey) throw new Error('GOOGLE_MAPS_KEY_MISSING')
  if (configuredKey && configuredKey !== apiKey) {
    throw new Error('GOOGLE_MAPS_KEY_CHANGED')
  }

  if (!loadPromise) {
    configuredKey = apiKey
    setOptions({ key: apiKey, v: 'weekly', language: 'en' })
    loadPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('geocoding'),
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
  mapId: string,
  zoom = 15,
): Promise<GoogleMapsController> {
  await loadGoogleMaps(apiKey)

  const map = new google.maps.Map(container, createBukiMapOptions(center, mapId, zoom))

  return {
    map,
    routePolylines: [],
    markers: [],
  }
}

export function moveGoogleMap(controller: GoogleMapsController, center: GeoPoint, zoom?: number) {
  controller.map.panTo(center)
  if (typeof zoom === 'number') controller.map.setZoom(zoom)
}

export function clearGoogleMapRoute(controller: GoogleMapsController) {
  controller.routePolylines.forEach((polyline) => polyline.setMap(null))
  controller.routePolylines = []
}

export function enableGoogleMapPointSelection(
  controller: GoogleMapsController,
  onSelect: (coordinates: GeoPoint) => void,
) {
  controller.map.addListener('click', (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return
    onSelect({ lat: event.latLng.lat(), lng: event.latLng.lng() })
  })
}

function coordinateDetail(coordinates: GeoPoint) {
  return `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
}

export async function describeGoogleMapPoint(coordinates: GeoPoint): Promise<GoogleMapAddress> {
  const { Geocoder } = await importLibrary('geocoding') as google.maps.GeocodingLibrary
  const response = await new Geocoder().geocode({ location: coordinates, language: 'en' })
  const result = response.results[0]
  if (!result) {
    return { name: 'Selected point', detail: coordinateDetail(coordinates) }
  }

  const locality = result.address_components.find((component) =>
    component.types.includes('locality') || component.types.includes('administrative_area_level_1'),
  )?.long_name

  return {
    name: result.formatted_address,
    detail: locality ?? coordinateDetail(coordinates),
  }
}

export function updateGoogleMapMarkers(
  controller: GoogleMapsController,
  origin: TripLocation,
  stops: TripStop[],
) {
  controller.markers.forEach((marker) => { marker.map = null })
  controller.markers = []

  const createMarker = (position: GeoPoint, title: string, glyphText: string, zIndex: number) => {
    const pin = new google.maps.marker.PinElement({
      background: '#e56e47',
      borderColor: '#fffdf4',
      glyphColor: '#fffdf4',
      glyphText,
    })
    return new google.maps.marker.AdvancedMarkerElement({
      map: controller.map,
      position,
      title,
      content: pin,
      zIndex,
    })
  }

  controller.markers.push(createMarker(origin.coordinates, origin.name, '●', 10))

  stops.forEach((stop) => {
    controller.markers.push(createMarker(
      stop.place.coordinates,
      stop.place.name,
      String(stop.sequence),
      stop.sequence,
    ))
  })
}

function searchRadiusMeters(radiusMeters?: number) {
  if (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters)) return DEFAULT_SEARCH_RADIUS_METERS
  return Math.min(50000, Math.max(100, Math.round(radiusMeters)))
}

async function findNearbyByKind(
  origin: GeoPoint,
  kind: PlaceKind,
  maxResultCount: number,
  radiusMeters?: number,
): Promise<NearbyCandidate[]> {
  const { Place } = await importLibrary('places')
  const { SearchNearbyRankPreference } = await importLibrary('places')
  const response = await Place.searchNearby({
    fields: ['id', 'displayName', 'formattedAddress', 'location', 'googleMapsURI'],
    includedPrimaryTypes: CATEGORY_TYPES[kind],
    locationRestriction: { center: origin, radius: searchRadiusMeters(radiusMeters) },
    maxResultCount,
    rankPreference: SearchNearbyRankPreference.POPULARITY,
    language: 'en',
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
    ? 'Permanently closed'
    : isOpen === true
      ? 'Open now'
      : isOpen === false
        ? 'Closed now'
        : 'Status unavailable'

  return {
    id: place.id,
    name: place.displayName,
    kind,
    summary: place.editorialSummary ?? `A ${CATEGORY_LABELS[kind]} option found near you.`,
    address: place.formattedAddress ?? 'Address unavailable',
    availability,
    availabilityLabel,
    checkedAt: `Checked now · ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    coordinates: { lat: place.location.lat(), lng: place.location.lng() },
    mapsUrl: place.googleMapsURI ?? undefined,
  }
}

async function searchFinalPlaces(
  origin: GeoPoint,
  request?: TripRequest,
  onProgress?: (message: GoogleMapProgress) => void,
): Promise<TripPlace[]> {
  onProgress?.('Searching nearby places')
  const kinds = request?.interests.length ? request.interests : ['food', 'culture', 'view'] as PlaceKind[]
  const desiredStops = request?.stopCount ?? 3
  const candidateGroups = await Promise.all(
    kinds.map(async (kind) => {
      try {
        return await findNearbyByKind(origin, kind, desiredStops, request?.searchRadiusMeters)
      } catch {
        return []
      }
    }),
  )

  const finalists: NearbyCandidate[] = []
  for (let candidateIndex = 0; finalists.length < desiredStops; candidateIndex += 1) {
    let addedCandidate = false
    for (const candidates of candidateGroups) {
      const candidate = candidates[candidateIndex]
      if (candidate) {
        finalists.push(candidate)
        addedCandidate = true
      }
      if (finalists.length >= desiredStops) break
    }
    if (!addedCandidate) break
  }

  onProgress?.('Checking nearby place details')
  const places = await Promise.all(finalists.map(fetchPlaceDetails))
  return places.filter((place): place is TripPlace => Boolean(place))
}

async function computeWalkingRoute(
  origin: GeoPoint,
  places: TripPlace[],
): Promise<RouteResult> {
  const destinations = places.filter((place) => Boolean(place.coordinates))
  if (destinations.length === 0) throw new Error('GOOGLE_MAPS_NO_ROUTE_DESTINATIONS')

  const { Route } = await importLibrary('routes') as google.maps.RoutesLibrary
  const destination = destinations[destinations.length - 1].coordinates!
  const intermediates = destinations.slice(0, -1).map((place) => ({
    location: place.coordinates!,
    via: false,
  }))

  const response = await Route.computeRoutes({
    origin,
    destination,
    intermediates,
    travelMode: 'WALKING',
    language: 'en',
    units: google.maps.UnitSystem.METRIC,
    fields: ['path', 'legs', 'warnings'],
  })

  const route = response.routes?.[0]
  if (!route) throw new Error('GOOGLE_MAPS_NO_ROUTE')

  const legs = route?.legs ?? []
  const segments = destinations.map((place, index) => {
    const leg = legs[index]
    return {
      fromId: index === 0 ? 'origin' : destinations[index - 1].id,
      toId: place.id,
      minutes: Math.max(1, Math.round((leg?.durationMillis ?? 0) / 60000)),
      meters: leg?.distanceMeters ?? 0,
    }
  })

  return {
    segments,
    warnings: route?.warnings ?? [],
    route,
  }
}

function assertRouteFitsRequest(route: RouteResult, places: TripPlace[], request?: TripRequest) {
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

function drawWalkingRoute(controller: GoogleMapsController, route: google.maps.routes.Route) {
  clearGoogleMapRoute(controller)
  controller.routePolylines = route.createPolylines({
    polylineOptions: {
      strokeColor: '#e56e47',
      strokeOpacity: 0.95,
      strokeWeight: 5,
    },
  })
  controller.routePolylines.forEach((polyline) => polyline.setMap(controller.map))
}

export async function buildGoogleTripPlan(
  controller: GoogleMapsController,
  origin: TripLocation,
  title: string,
  city: string,
  request?: TripRequest,
  onProgress?: (message: GoogleMapProgress) => void,
): Promise<TripPlan> {
  if (!origin.coordinates) throw new Error('GOOGLE_MAPS_ORIGIN_MISSING')

  const places = await searchFinalPlaces(origin.coordinates, request, onProgress)
  if (places.length < 2) throw new Error('GOOGLE_MAPS_NOT_ENOUGH_PLACES')

  clearGoogleMapRoute(controller)
  onProgress?.('Calculating a walkable route')
  const route = await computeWalkingRoute(origin.coordinates, places)
  assertRouteFitsRequest(route, places, request)
  onProgress?.('Adding the route to your map')
  drawWalkingRoute(controller, route.route)
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
    totalEstimatedMinutes: stops.reduce((sum, stop) => sum + stop.walkFromPrevious.minutes, 0)
      + places.reduce((sum, place) => sum + STOP_DURATION_MINUTES[place.kind], 0),
    stops,
    source: 'google-maps',
    checkedAt: `Google Maps · ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    routeWarnings: route.warnings,
  }
}
