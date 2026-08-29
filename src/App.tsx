import { useEffect, useRef, useState, type FormEvent } from 'react'
import { WebMcpInspector } from './components/WebMcpInspector'
import type { GoogleMapsController } from './integrations/googleMaps'
import {
  buildGoogleTripPlan,
  clearGoogleMapRoute,
  createGoogleMap,
  describeGoogleMapPoint,
  enableGoogleMapPointSelection,
  moveGoogleMap,
  updateGoogleMapMarkers,
} from './integrations/googleMaps'
import type { GeoPoint, PlaceKind, TripLocation, TripPlace, TripPlan, TripRequest, TripStop } from './types'
import { useWebMcp } from './hooks/useWebMcp'
import type { BukiWebMcpActions } from './integrations/webmcp'

type MapState = 'loading' | 'ready' | 'error' | 'unavailable'
type LocationState = 'idle' | 'picking' | 'requesting' | 'resolving' | 'selected' | 'denied' | 'unsupported'
type RealPlanState = 'idle' | 'loading' | 'ready' | 'error'

interface PlannerResponse {
  mode: 'llm'
  intent: string
  title: string
  explanation: string
  request: TripRequest
}

const DEFAULT_INTENT = 'I have the afternoon free and would like a local food and culture walk with short distances between stops.'
const DEFAULT_MAP_CENTER: GeoPoint = { lat: 20, lng: 0 }
const DEFAULT_MAP_ZOOM = 2
const SELECTED_POINT_ZOOM = 15

const KIND_LABELS = {
  food: 'Eat something local',
  culture: 'Culture',
  view: 'Viewpoint',
} as const

const KIND_SYMBOLS = {
  food: '✦',
  culture: '◇',
  view: '△',
} as const

const apiUrl = import.meta.env.VITE_BUKI_API_URL ?? ''
const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

function coordinateDetail(coordinates: GeoPoint) {
  return `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
}

function getGoogleErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'GOOGLE_MAPS_KEY_MISSING') return 'Configure a Google Maps key to build a real route.'
    if (error.message === 'GOOGLE_MAPS_NOT_ENOUGH_PLACES') return 'Google Maps did not find enough nearby places to build the route.'
    if (error.message === 'GOOGLE_MAPS_ROUTE_EXCEEDS_WALK_LIMIT') return 'The available places do not fit your maximum walking time per leg.'
    if (error.message === 'GOOGLE_MAPS_ROUTE_EXCEEDS_TIME_LIMIT') return 'The available places do not fit your available time.'
    if (error.message.includes('REQUEST_DENIED') || error.message.includes('ApiNotActivated')) {
      return 'Google Maps rejected the request. Check enabled APIs, restrictions, and key billing.'
    }
  }
  return 'We could not query Google Maps right now. Please try again.'
}

function getPlannerErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.startsWith('GOOGLE_MAPS_')) return getGoogleErrorMessage(error)
  if (error instanceof Error && error.message) return error.message
  return 'We could not interpret that request. Please try again.'
}

function isPlannerResponse(value: unknown): value is PlannerResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  const request = candidate.request
  if (!request || typeof request !== 'object') return false
  const parsedRequest = request as Record<string, unknown>
  return (
    candidate.mode === 'llm' &&
    typeof candidate.intent === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.explanation === 'string' &&
    Array.isArray(parsedRequest.interests) &&
    typeof parsedRequest.availableMinutes === 'number' &&
    typeof parsedRequest.maxWalkMinutes === 'number' &&
    (parsedRequest.stopCount === 2 || parsedRequest.stopCount === 3)
  )
}

function pointFromToolInput(input: Record<string, unknown>): GeoPoint | null {
  const latitude = input.latitude
  const longitude = input.longitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { lat: latitude, lng: longitude }
}

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const googleMapRef = useRef<GoogleMapsController | null>(null)
  const mapInitializationRef = useRef<Promise<GoogleMapsController> | null>(null)
  const mapPointSelectionRef = useRef(false)
  const [mapState, setMapState] = useState<MapState>(mapsApiKey ? 'loading' : 'unavailable')
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [realPlanState, setRealPlanState] = useState<RealPlanState>('idle')
  const [plannerRequest, setPlannerRequest] = useState<TripRequest | null>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const [intent, setIntent] = useState(DEFAULT_INTENT)
  const [origin, setOrigin] = useState<TripLocation | null>(null)
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [activeStopIndex, setActiveStopIndex] = useState(0)
  const [notice, setNotice] = useState('')
  const [mapError, setMapError] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(false)

  async function ensureGoogleMap(center = DEFAULT_MAP_CENTER, zoom = DEFAULT_MAP_ZOOM) {
    if (!mapsApiKey) throw new Error('GOOGLE_MAPS_KEY_MISSING')
    if (googleMapRef.current) {
      moveGoogleMap(googleMapRef.current, center, zoom)
      return googleMapRef.current
    }
    if (mapInitializationRef.current) return mapInitializationRef.current
    if (!mapContainerRef.current) throw new Error('GOOGLE_MAPS_CONTAINER_MISSING')

    setMapState('loading')
    const initialization = createGoogleMap(mapContainerRef.current, center, mapsApiKey, zoom)
      .then((controller) => {
        googleMapRef.current = controller
        enableGoogleMapPointSelection(controller, (coordinates) => {
          if (!mapPointSelectionRef.current) return
          void selectOriginFromPoint(coordinates, 'map')
        })
        setMapState('ready')
        return controller
      })
      .catch((error) => {
        mapInitializationRef.current = null
        setMapState('error')
        setMapError(getGoogleErrorMessage(error))
        throw error
      })

    mapInitializationRef.current = initialization
    return initialization
  }

  useEffect(() => {
    if (!mapsApiKey) return
    void ensureGoogleMap().catch(() => undefined)
    // The map is initialized once. Later origin changes are handled by selectOriginFromPoint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsApiKey])

  useEffect(() => {
    if (!googleMapRef.current || !origin) return
    moveGoogleMap(googleMapRef.current, origin.coordinates, SELECTED_POINT_ZOOM)
    updateGoogleMapMarkers(googleMapRef.current, origin, plan?.stops ?? [])
  }, [origin, plan])

  const stops = plan?.stops ?? []
  const availableStops = stops.filter((stop) => stop.place.availability !== 'closed')
  const currentStop = availableStops.length
    ? availableStops[Math.min(activeStopIndex, availableStops.length - 1)]
    : undefined
  const totalWalkingMinutes = plan?.totalWalkingMinutes ?? 0
  const mapLabel = mapState === 'ready'
    ? plan ? 'Google Maps · real route' : 'Google Maps ready'
    : mapState === 'loading'
      ? 'Loading Google Maps'
      : mapState === 'error'
        ? 'Maps unavailable'
        : 'Maps key required'

  async function selectOriginFromPoint(coordinates: GeoPoint, source: 'device' | 'map' | 'agent'): Promise<TripLocation> {
    mapPointSelectionRef.current = false
    setLocationState('resolving')
    setNotice('Looking up the selected location…')

    const controller = await ensureGoogleMap(coordinates, SELECTED_POINT_ZOOM)
    let name = source === 'device' ? 'Current location' : 'Selected point'
    let detail = coordinateDetail(coordinates)
    try {
      const address = await describeGoogleMapPoint(coordinates)
      name = address.name
      detail = address.detail
    } catch {
      // Coordinates remain a truthful fallback if reverse geocoding is unavailable.
    }

    const nextOrigin: TripLocation = {
      id: `point-${coordinates.lat.toFixed(6)}-${coordinates.lng.toFixed(6)}`,
      name,
      detail,
      coordinates,
    }
    setOrigin(nextOrigin)
    setPlan(null)
    setActiveStopIndex(0)
    setRealPlanState('idle')
    clearGoogleMapRoute(controller)
    updateGoogleMapMarkers(controller, nextOrigin, [])
    setLocationState('selected')
    setNotice(source === 'device'
      ? 'Your current location is ready. Describe what you want to do to build a route.'
      : 'Starting point selected. Describe what you want to do to build a route.')
    return nextOrigin
  }

  async function startMapPointSelection() {
    if (!mapsApiKey) {
      setNotice('Configure a Google Maps key before choosing a point on the map.')
      return
    }
    mapPointSelectionRef.current = true
    setLocationState('picking')
    setNotice('Tap a point on the map to use it as your starting point.')
    try {
      await ensureGoogleMap(origin?.coordinates ?? DEFAULT_MAP_CENTER, origin ? SELECTED_POINT_ZOOM : DEFAULT_MAP_ZOOM)
    } catch (error) {
      mapPointSelectionRef.current = false
      setLocationState('idle')
      setNotice(getGoogleErrorMessage(error))
    }
  }

  function requestDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationState('unsupported')
      setNotice('This browser does not support location access. Choose a point on the map instead.')
      return
    }

    mapPointSelectionRef.current = false
    setLocationState('requesting')
    setNotice('Waiting for permission to access your location…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void selectOriginFromPoint({ lat: coords.latitude, lng: coords.longitude }, 'device').catch((error) => {
          setLocationState('idle')
          setNotice(getGoogleErrorMessage(error))
        })
      },
      () => {
        setLocationState('denied')
        setNotice('Location permission was not granted. Choose a point on the map instead.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  async function fetchRealPlan(request = plannerRequest ?? undefined, title = plan?.title ?? 'A walk near your starting point') {
    if (!origin) throw new Error('GOOGLE_MAPS_ORIGIN_MISSING')
    const controller = await ensureGoogleMap(origin.coordinates, SELECTED_POINT_ZOOM)
    return buildGoogleTripPlan(controller, origin, title, origin.detail, request)
  }

  async function searchRealPlan() {
    if (!origin) {
      setNotice('Choose your current location or a point on the map first.')
      return
    }
    if (!mapsApiKey) {
      setNotice('Configure a Google Maps key to build a real route.')
      return
    }

    setRealPlanState('loading')
    setNotice('Querying places, opening hours, and walking route…')
    clearGoogleMapRoute(googleMapRef.current!)
    setPlan(null)
    try {
      const realPlan = await fetchRealPlan()
      setPlan(realPlan)
      setActiveStopIndex(0)
      setRealPlanState('ready')
      setNotice(realPlan.routeWarnings?.length
        ? 'Real plan ready. Review the route walking warning.'
        : `Real plan ready with ${realPlan.stops.length} nearby places.`)
    } catch (error) {
      setRealPlanState('error')
      setNotice(getGoogleErrorMessage(error))
    }
  }

  async function requestLlmPlan(nextIntent: string): Promise<PlannerResponse> {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: nextIntent }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && typeof payload.error === 'string'
        ? payload.error
        : 'The planning function is unavailable.'
      throw new Error(message)
    }
    if (!isPlannerResponse(payload)) throw new Error('The planning function returned an invalid response.')
    return payload
  }

  async function submitIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextIntent = intent.trim()
    if (!nextIntent) {
      setNotice('Tell Buki what you would like to do.')
      return
    }
    if (!origin) {
      setNotice('Choose your current location or a point on the map before building a route.')
      return
    }
    if (!mapsApiKey) {
      setNotice('Configure a Google Maps key before building a route.')
      return
    }

    setIsPlanning(true)
    setNotice('Interpreting your request…')
    try {
      const planner = await requestLlmPlan(nextIntent)
      setPlannerRequest(planner.request)
      setIntent(planner.intent)
      setRealPlanState('loading')
      setNotice('Finding real places and calculating the walking route…')
      clearGoogleMapRoute(googleMapRef.current!)
      setPlan(null)
      const realPlan = await fetchRealPlan(planner.request, planner.title)
      setPlan(realPlan)
      setActiveStopIndex(0)
      setRealPlanState('ready')
      setNotice(planner.explanation || `Real plan ready with ${realPlan.stops.length} nearby places.`)
    } catch (error) {
      setRealPlanState('error')
      setNotice(getPlannerErrorMessage(error))
    } finally {
      setIsPlanning(false)
    }
  }

  function moveToNextStop() {
    if (!availableStops.length) {
      setNotice('Build a real route before starting a leg.')
      return
    }
    if (activeStopIndex >= availableStops.length - 1) {
      setNotice('You reached the end of the route. You can return to any stop in the plan.')
      return
    }
    const nextIndex = activeStopIndex + 1
    setActiveStopIndex(nextIndex)
    setNotice(`Next: ${availableStops[nextIndex].place.name}.`)
  }

  function serializePlanData(currentPlan: TripPlan) {
    return {
      status: 'ok',
      title: currentPlan.title,
      city: currentPlan.city,
      source: currentPlan.source,
      checkedAt: currentPlan.checkedAt,
      origin: { id: currentPlan.origin.id, name: currentPlan.origin.name, detail: currentPlan.origin.detail },
      totalWalkingMinutes: currentPlan.totalWalkingMinutes,
      stops: currentPlan.stops.map((stop) => ({
        id: stop.place.id,
        sequence: stop.sequence,
        name: stop.place.name,
        kind: stop.place.kind,
        address: stop.place.address,
        availability: stop.place.availability,
        availabilityLabel: stop.place.availabilityLabel,
        checkedAt: stop.place.checkedAt,
        walkFromPrevious: stop.walkFromPrevious,
      })),
    }
  }

  function serializePlan() {
    if (plan) return serializePlanData(plan)
    return {
      status: origin ? 'ready_to_plan' : 'needs_origin',
      origin: origin ? { id: origin.id, name: origin.name, detail: origin.detail } : null,
      stops: [],
    }
  }

  function findToolStop(input: Record<string, unknown>) {
    const stopId = typeof input.stopId === 'string' ? input.stopId : ''
    return stops.find((stop) => stop.id === stopId || stop.place.id === stopId)
  }

  const webMcpActions: BukiWebMcpActions = {
    async searchNearbyPlaces(input) {
      if (!origin) return { status: 'needs_origin', message: 'The person must select a real starting point first.' }
      if (!mapsApiKey) return { status: 'unavailable', message: 'Google Maps is not configured.' }
      const requestedKind = typeof input.kind === 'string' && ['food', 'culture', 'view'].includes(input.kind)
        ? input.kind as PlaceKind
        : undefined
      const request = requestedKind
        ? { ...(plannerRequest ?? { availableMinutes: 180, maxWalkMinutes: 20, stopCount: 3 }), interests: [requestedKind] as PlaceKind[] }
        : plannerRequest ?? undefined
      try {
        const realPlan = await fetchRealPlan(request)
        setPlan(realPlan)
        setActiveStopIndex(0)
        setRealPlanState('ready')
        return { status: 'ok', source: 'google-maps', itinerary: serializePlanData(realPlan) }
      } catch (error) {
        return { status: 'error', message: getGoogleErrorMessage(error), itinerary: serializePlan() }
      }
    },
    getPlaceStatus(input) {
      const stop = findToolStop({ stopId: input.placeId })
      if (!stop) throw new Error('PLACE_NOT_FOUND')
      return {
        status: 'ok',
        placeId: stop.place.id,
        name: stop.place.name,
        availability: stop.place.availability,
        availabilityLabel: stop.place.availabilityLabel,
        checkedAt: stop.place.checkedAt,
      }
    },
    computeWalkingRoute(input) {
      const stop = findToolStop({ stopId: input.toPlaceId })
      if (!stop) throw new Error('DESTINATION_NOT_FOUND')
      return { status: 'ok', route: stop.walkFromPrevious, source: 'google-maps' }
    },
    getItinerary: serializePlan,
    proposeItinerary(input) {
      const requestedIntent = typeof input.intent === 'string' ? input.intent : intent
      setNotice('An agent prepared a proposal visible to the person; it has not been applied.')
      return { status: 'proposal', intent: requestedIntent, itinerary: serializePlan(), applied: false }
    },
    replaceStop(input) {
      const stop = findToolStop(input)
      if (!stop) throw new Error('STOP_NOT_FOUND')
      return {
        status: 'unavailable',
        message: 'Real replacement search is not implemented yet, so Buki will not invent a replacement.',
        stopId: stop.id,
      }
    },
    focusStop(input) {
      const stop = findToolStop(input)
      if (!stop) throw new Error('STOP_NOT_FOUND')
      const nextIndex = availableStops.findIndex((item) => item.id === stop.id)
      if (nextIndex < 0) throw new Error('STOP_NOT_AVAILABLE')
      setActiveStopIndex(nextIndex)
      setNotice(`Next stop focused: ${stop.place.name}.`)
      return { status: 'ok', focusedStopId: stop.id, name: stop.place.name }
    },
    async setOrigin(input) {
      const coordinates = pointFromToolInput(input)
      if (!coordinates) throw new Error('VALID_LATITUDE_AND_LONGITUDE_REQUIRED')
      const selectedOrigin = await selectOriginFromPoint(coordinates, 'agent')
      return { status: 'ok', origin: { id: selectedOrigin.id, name: selectedOrigin.name, detail: selectedOrigin.detail } }
    },
    updateIntent(input) {
      const nextIntent = typeof input.intent === 'string' ? input.intent.trim() : ''
      if (!nextIntent) throw new Error('INTENT_REQUIRED')
      setIntent(nextIntent)
      setNotice('Intent updated by an agent; the person must submit it to build a real route.')
      return { status: 'ok', intent: nextIntent, planUpdated: false }
    },
    advanceToNextStop() {
      const nextStop = availableStops[Math.min(activeStopIndex + 1, availableStops.length - 1)]
      moveToNextStop()
      return { status: 'ok', nextStop: nextStop ? { id: nextStop.id, name: nextStop.place.name } : null }
    },
    getBukiContext() {
      return {
        app: 'buki',
        webmcp: Boolean(document.modelContext),
        mapSource: plan?.source ?? 'pending',
        origin: origin?.name ?? null,
        stopCount: stops.length,
        manualControlsAvailable: true,
      }
    },
  }

  const webmcp = useWebMcp(webMcpActions)

  return (
    <main className={`app-shell ${mapState === 'ready' ? 'has-real-map' : ''}`}>
      <section className={`map-stage ${mapState === 'ready' ? 'is-google-map' : ''}`} aria-label="Google Maps">
        <div ref={mapContainerRef} className={`google-map-canvas ${mapState === 'ready' ? 'is-visible' : 'is-hidden'}`} aria-hidden={mapState !== 'ready'} />
        {mapState !== 'ready' && (
          <div className="map-unavailable">
            <strong>{mapState === 'loading' ? 'Loading Google Maps…' : 'Google Maps is unavailable'}</strong>
            <span>{mapError || 'A valid Maps key is required to select a real starting point.'}</span>
          </div>
        )}

        <div className="map-header">
          <div className="brand-lockup">
            <span className="brand-mark">b</span>
            <span>buki</span>
          </div>
          <div className="map-header-actions">
            <button className="webmcp-connection voyage-connection" data-testid="open-webmcp-inspector" type="button" onClick={() => setInspectorOpen(true)}>
              <span className={`webmcp-status-dot voyage-status-dot is-${webmcp.status}`} />
              <span>WebMCP</span>
              <span className="webmcp-tool-count voyage-tool-count">{webmcp.definitions.length} tools</span>
            </button>
            <span className="map-mode">{mapLabel}</span>
          </div>
        </div>

        <div className="map-location-label">
          <span className="pulse-dot" />
          {origin ? origin.name : 'Choose a starting point'}
          <small>{origin ? origin.detail : 'Use your location or tap a pin on the map.'}</small>
        </div>

        <div className="map-footer">
          <div>
            <strong>{plan ? `${stops.length} stops` : 'No route yet'}</strong>
            {plan && <><span>·</span><strong>{totalWalkingMinutes} min walking</strong></>}
          </div>
          <span>{plan ? `${plan.checkedAt}${plan.routeWarnings?.length ? ' · Review warnings' : ''}` : 'Real data starts after you choose a point.'}</span>
        </div>
      </section>

      <section className="plan-sheet" aria-labelledby="plan-title">
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="plan-content">
          <header className="plan-header">
            <div>
              <p className="eyebrow">Your walking plan</p>
              <h1 id="plan-title">{plan?.title ?? 'Start with a real location'}</h1>
              <p className="plan-location">{plan ? `${plan.city} · ${totalWalkingMinutes} min walking` : 'Use your current location or drop a pin anywhere on the map.'}</p>
            </div>
            <span className={`plan-status ${plan ? 'is-real' : ''}`}>{plan ? 'Real' : 'Waiting for origin'}</span>
          </header>

          <section className="location-card" aria-labelledby="location-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Starting point</p>
                <h2 id="location-title">Choose where you are</h2>
              </div>
              <span className="location-icon" aria-hidden="true">⌖</span>
            </div>
            <p className="origin-summary">
              {origin ? <><strong>{origin.name}</strong><span>{origin.detail}</span></> : 'No starting point selected yet.'}
            </p>
            <div className="location-actions">
              <button className="text-button" type="button" onClick={requestDeviceLocation} disabled={locationState === 'requesting' || locationState === 'resolving'}>
                <span aria-hidden="true">◎</span> {locationState === 'requesting' ? 'Waiting for permission…' : 'Use my current location'}
              </button>
              <button className="text-button secondary" type="button" onClick={() => void startMapPointSelection()} disabled={mapState !== 'ready' || locationState === 'resolving'}>
                {locationState === 'picking' ? 'Tap the map to set the point' : 'Choose a point on the map'}
              </button>
            </div>
            {mapsApiKey ? (
              <button className="real-search-button" type="button" onClick={() => void searchRealPlan()} disabled={!origin || realPlanState === 'loading' || isPlanning}>
                <span>{realPlanState === 'loading' ? 'Querying Google Maps…' : 'Build a real route nearby'}</span>
                <span aria-hidden="true">↗</span>
              </button>
            ) : (
              <p className="key-hint">Configure <code>VITE_GOOGLE_MAPS_API_KEY</code> to choose a real point and build a route.</p>
            )}
          </section>

          <form className="intent-form" onSubmit={submitIntent}>
            <label htmlFor="intent">What do you want to do?</label>
            <textarea id="intent" value={intent} onChange={(event) => setIntent(event.target.value)} rows={3} />
            <button className="primary-button" type="submit" disabled={isPlanning || !origin}>
              {isPlanning ? 'Building your plan…' : 'Build a real plan'} <span aria-hidden="true">↗</span>
            </button>
          </form>

          {notice && <p className="notice" aria-live="polite">{notice}</p>}
          {locationState === 'denied' && <p className="state-hint">Location permission was denied. Choose a point on the map instead.</p>}
          {locationState === 'unsupported' && <p className="state-hint">This browser does not expose geolocation. Choose a point on the map instead.</p>}

          {plan && currentStop && (
            <section className="next-stop-card" aria-labelledby="next-stop-title">
              <div className="next-stop-topline">
                <p className="section-kicker">Next stop</p>
                <span>{currentStop.sequence.toString().padStart(2, '0')} / {stops.length.toString().padStart(2, '0')}</span>
              </div>
              <h2 id="next-stop-title">{currentStop.place.name}</h2>
              <p>{currentStop.place.summary}</p>
              <div className="next-stop-meta">
                <span>{currentStop.walkFromPrevious.minutes} min from here</span>
                <span>{formatDistance(currentStop.walkFromPrevious.meters)}</span>
              </div>
              <button className="dark-button" type="button" onClick={moveToNextStop}>
                {activeStopIndex >= availableStops.length - 1 ? 'Mark route complete' : 'Start this leg'}
                <span aria-hidden="true">→</span>
              </button>
            </section>
          )}

          {plan ? (
            <section className="stops-section" aria-labelledby="stops-title">
              <div className="section-heading stops-heading">
                <div>
                  <p className="section-kicker">Suggested route</p>
                  <h2 id="stops-title">Places near you</h2>
                </div>
                <span className="walking-limit">Max. {plannerRequest?.maxWalkMinutes ?? '—'} min / leg</span>
              </div>
              <div className="stops-list">
                {stops.map((stop, index) => (
                  <StopCard key={stop.id} stop={stop} isCurrent={currentStop?.id === stop.id} showWalking={index > 0 || Boolean(stop.walkFromPrevious)} />
                ))}
              </div>
            </section>
          ) : (
            <section className="empty-plan" aria-labelledby="empty-plan-title">
              <p className="section-kicker">Real-data flow</p>
              <h2 id="empty-plan-title">Choose a point, then describe your plan.</h2>
              <p>Buki will use the LLM to understand your request and Google Maps to find the actual places and walking route.</p>
            </section>
          )}

          {plan && (
            <footer className="data-footer">
              <span className="data-dot" />
              <span>{plan.checkedAt} · Data may change.</span>
            </footer>
          )}
        </div>
      </section>
      <WebMcpInspector
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        status={webmcp.status}
        definitions={webmcp.definitions}
        registeredTools={webmcp.registeredTools}
        registeredCount={webmcp.registeredCount}
        calls={webmcp.calls}
      />
    </main>
  )
}

interface StopCardProps {
  stop: TripStop
  isCurrent: boolean
  showWalking: boolean
}

function StopCard({ stop, isCurrent, showWalking }: StopCardProps) {
  const place: TripPlace = stop.place
  const isClosed = place.availability === 'closed'

  return (
    <div className="stop-group">
      {showWalking && (
        <div className="walking-connector">
          <span className="connector-line" />
          <span><strong>{stop.walkFromPrevious.minutes} min</strong> · {formatDistance(stop.walkFromPrevious.meters)} walking</span>
        </div>
      )}
      <article className={`stop-card ${isCurrent ? 'is-current' : ''} ${isClosed ? 'is-closed' : ''}`}>
        <div className="stop-number">{stop.sequence.toString().padStart(2, '0')}</div>
        <div className="stop-card-body">
          <div className="stop-card-topline">
            <span className="stop-kind">{KIND_SYMBOLS[place.kind]} {KIND_LABELS[place.kind]}</span>
            <span className={`availability availability-${place.availability}`}>{place.availabilityLabel}</span>
          </div>
          <h3>{place.name}</h3>
          <p>{place.summary}</p>
          <div className="stop-card-details">
            <span>{place.address}</span>
            <span>{place.checkedAt}</span>
          </div>
          {place.mapsUrl && <a className="maps-link" href={place.mapsUrl} target="_blank" rel="noreferrer">View on Google Maps ↗</a>}
          {isClosed && <p className="availability-note">This place is currently unavailable. Buki will not invent a replacement.</p>}
        </div>
      </article>
    </div>
  )
}

export default App
