import { useEffect, useRef, useState, type FormEvent } from 'react'
import { WebMcpInspector } from './components/WebMcpInspector'
import type { GoogleMapsController } from './integrations/googleMaps'
import {
  buildGoogleTripPlan,
  createGoogleMap,
  moveGoogleMap,
  updateGoogleMapMarkers,
} from './integrations/googleMaps'
import type { TripLocation, TripPlace, TripStop } from './types'
import { useWebMcp } from './hooks/useWebMcp'
import type { BukiWebMcpActions } from './integrations/webmcp'
import {
  DEFAULT_INTENT,
  getMockItinerary,
  MOCK_ALTERNATIVE,
  MOCK_LOCATIONS,
} from './data/mockItinerary'

type ServerState = 'mock' | 'checking' | 'online' | 'offline'
type MapState = 'mock' | 'loading' | 'ready' | 'error'
type LocationState = 'manual' | 'simulated' | 'requesting' | 'granted' | 'denied' | 'unsupported'
type RealPlanState = 'idle' | 'loading' | 'ready' | 'error'

const mode = import.meta.env.VITE_BUKI_MODE ?? 'mock'
const apiUrl = import.meta.env.VITE_BUKI_API_URL ?? ''
const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''
const isMock = mode === 'mock'
const DEFAULT_MAP_CENTER = { lat: -33.4372, lng: -70.6506 }

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

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

function getGoogleErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'GOOGLE_MAPS_KEY_MISSING') return 'Configure a Google Maps key to search real places.'
    if (error.message === 'GOOGLE_MAPS_NOT_ENOUGH_PLACES') return 'Google Maps did not find enough nearby places to build the route.'
    if (error.message.includes('REQUEST_DENIED') || error.message.includes('ApiNotActivated')) {
      return 'Google Maps rejected the request. Check enabled APIs, restrictions, and key billing.'
    }
  }
  return 'We could not query Google Maps right now. The simulated route is still available.'
}

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const googleMapRef = useRef<GoogleMapsController | null>(null)
  const mapInitializationRef = useRef<Promise<GoogleMapsController> | null>(null)
  const [serverState, setServerState] = useState<ServerState>(isMock ? 'mock' : 'checking')
  const [mapState, setMapState] = useState<MapState>(mapsApiKey ? 'loading' : 'mock')
  const [locationState, setLocationState] = useState<LocationState>('manual')
  const [realPlanState, setRealPlanState] = useState<RealPlanState>('idle')
  const [intent, setIntent] = useState(DEFAULT_INTENT)
  const [selectedLocationId, setSelectedLocationId] = useState('plaza-armas')
  const [origin, setOrigin] = useState<TripLocation>(() => getMockItinerary().origin)
  const [plan, setPlan] = useState(() => getMockItinerary())
  const [replacementApplied, setReplacementApplied] = useState(false)
  const [activeStopIndex, setActiveStopIndex] = useState(0)
  const [notice, setNotice] = useState('')
  const [mapError, setMapError] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(false)

  useEffect(() => {
    if (isMock) return

    const controller = new AbortController()

    fetch(`${apiUrl}/api/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Server health check failed')
        setServerState('online')
      })
      .catch(() => {
        if (!controller.signal.aborted) setServerState('offline')
      })

    return () => controller.abort()
  }, [])

  async function ensureGoogleMap(center: { lat: number; lng: number }) {
    if (!mapsApiKey) throw new Error('GOOGLE_MAPS_KEY_MISSING')
    if (googleMapRef.current) {
      moveGoogleMap(googleMapRef.current, center)
      return googleMapRef.current
    }
    if (mapInitializationRef.current) return mapInitializationRef.current
    if (!mapContainerRef.current) throw new Error('GOOGLE_MAPS_CONTAINER_MISSING')

    setMapState('loading')
    const initialization = createGoogleMap(mapContainerRef.current, center, mapsApiKey)
      .then((controller) => {
        googleMapRef.current = controller
        setMapState('ready')
        updateGoogleMapMarkers(controller, plan.origin, plan.stops)
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
    void ensureGoogleMap(plan.origin.coordinates ?? DEFAULT_MAP_CENTER).catch(() => undefined)
    // The map is initialized once. Later origin changes are handled by changeLocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsApiKey])

  useEffect(() => {
    if (!googleMapRef.current || !plan.origin.coordinates) return
    moveGoogleMap(googleMapRef.current, plan.origin.coordinates)
    updateGoogleMapMarkers(googleMapRef.current, plan.origin, plan.stops)
  }, [plan])

  const usingMockRepair = plan.source !== 'google-maps'
  const effectiveStops = plan.stops.map((stop) => {
    if (!usingMockRepair || !replacementApplied || stop.id !== MOCK_ALTERNATIVE.replacesStopId) return stop
    return {
      ...stop,
      place: MOCK_ALTERNATIVE.place,
      walkFromPrevious: MOCK_ALTERNATIVE.walkFromPrevious,
    }
  })

  const availableStops = effectiveStops.filter((stop) => stop.place.availability !== 'closed')
  const currentStop = availableStops[Math.min(activeStopIndex, availableStops.length - 1)]
  const originalAffectedStop = usingMockRepair
    ? plan.stops.find((stop) => stop.id === MOCK_ALTERNATIVE.replacesStopId)
    : undefined
  const totalWalkingMinutes = replacementApplied && originalAffectedStop
    ? plan.totalWalkingMinutes - originalAffectedStop.walkFromPrevious.minutes + MOCK_ALTERNATIVE.walkFromPrevious.minutes
    : plan.totalWalkingMinutes
  const routePoints = [plan.origin, ...effectiveStops.map((stop) => stop.place)]
    .map((point) => `${point.x},${point.y}`)
    .join(' ')

  const serverLabel = {
    mock: 'Mock functions',
    checking: 'Checking connection',
    online: 'Functions connected',
    offline: 'Functions unavailable',
  }[serverState]

  const mapLabel = mapState === 'ready'
      ? plan.source === 'google-maps' ? 'Google Maps · real' : 'Google Maps ready'
    : mapState === 'loading'
      ? 'Loading Google Maps'
      : mapState === 'error'
        ? 'Mock · Maps unavailable'
        : 'Mock · no Maps key'

  function changeLocation(locationId: string) {
    const nextLocation = MOCK_LOCATIONS.find((location) => location.id === locationId)
    if (!nextLocation) return
    const nextPlan = getMockItinerary(locationId)
    setSelectedLocationId(locationId)
    setOrigin(nextLocation)
    setPlan(nextPlan)
    setReplacementApplied(false)
    setActiveStopIndex(0)
    setRealPlanState('idle')
    if (googleMapRef.current && nextLocation.coordinates) moveGoogleMap(googleMapRef.current, nextLocation.coordinates)
    setNotice(`Starting point updated: ${nextLocation.name}.`)
  }

  function useSimulatedLocation() {
    changeLocation('plaza-armas')
    setLocationState('simulated')
    setNotice('Using a simulated location near Plaza de Armas.')
  }

  function requestDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationState('unsupported')
      setNotice('This browser does not support location access. You can choose a point manually.')
      return
    }

    setLocationState('requesting')
    setNotice('Waiting for permission to access your location…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextOrigin: TripLocation = {
          id: 'current-location',
          name: 'My current location',
          detail: 'Device location',
          x: 48,
          y: 53,
          coordinates: { lat: coords.latitude, lng: coords.longitude },
        }
        setLocationState('granted')
        setSelectedLocationId(nextOrigin.id)
        setOrigin(nextOrigin)
        setPlan({ ...getMockItinerary(), origin: nextOrigin, city: 'Near you' })
        setReplacementApplied(false)
        setActiveStopIndex(0)
        setRealPlanState('idle')
        if (googleMapRef.current && nextOrigin.coordinates) moveGoogleMap(googleMapRef.current, nextOrigin.coordinates)
        setNotice('Location confirmed. You can now find real places nearby.')
      },
      () => {
        setLocationState('denied')
        setNotice('Location permission was not granted. You can choose a point manually or use the simulated location.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  async function fetchRealPlan() {
    if (!origin.coordinates) {
      throw new Error('GOOGLE_MAPS_ORIGIN_MISSING')
    }
    const controller = await ensureGoogleMap(origin.coordinates)
    return buildGoogleTripPlan(
      controller,
      origin,
      'A route to explore now',
      origin.detail,
    )
  }

  async function searchRealPlan() {
    if (!mapsApiKey) {
      setNotice('Add VITE_GOOGLE_MAPS_API_KEY to your local environment to query real places.')
      return
    }
    if (!origin.coordinates) {
      setNotice('Confirm a starting point before searching for real places.')
      return
    }

    setRealPlanState('loading')
    setNotice('Querying places, opening hours, and walking route…')
    try {
      const realPlan = await fetchRealPlan()
      setPlan(realPlan)
      setReplacementApplied(false)
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

  function submitIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(plan.source === 'google-maps'
      ? 'Intent updated. Find real places again to apply the new criteria.'
      : 'Intent saved. This plan still uses simulated data.')
  }

  function moveToNextStop() {
    if (activeStopIndex >= availableStops.length - 1) {
      setNotice('You reached the end of the route. You can return to any stop in the plan.')
      return
    }
    const nextIndex = activeStopIndex + 1
    setActiveStopIndex(nextIndex)
    setNotice(`Next: ${availableStops[nextIndex].place.name}.`)
  }

  function applyReplacement() {
    setReplacementApplied(true)
    setNotice(`Replacement applied: ${MOCK_ALTERNATIVE.place.name}.`)
  }

  function undoReplacement() {
    setReplacementApplied(false)
    setNotice('Replacement undone. The original stop is marked as closed again.')
  }

  function serializePlanData(currentPlan: typeof plan, currentStops: typeof effectiveStops, currentWalkingMinutes: number) {
    return {
      title: currentPlan.title,
      city: currentPlan.city,
      source: currentPlan.source ?? 'mock',
      checkedAt: currentPlan.checkedAt ?? 'Simulated data',
      origin: { id: currentPlan.origin.id, name: currentPlan.origin.name, detail: currentPlan.origin.detail },
      totalWalkingMinutes: currentWalkingMinutes,
      stops: currentStops.map((stop) => ({
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
    return serializePlanData(plan, effectiveStops, totalWalkingMinutes)
  }

  function findToolStop(input: Record<string, unknown>) {
    const stopId = typeof input.stopId === 'string' ? input.stopId : ''
    return effectiveStops.find((stop) => stop.id === stopId || stop.place.id === stopId)
  }

  const webMcpActions: BukiWebMcpActions = {
    async searchNearbyPlaces(input) {
      if (mapsApiKey && origin.coordinates) {
        try {
          const realPlan = await fetchRealPlan()
          setPlan(realPlan)
          setReplacementApplied(false)
          setActiveStopIndex(0)
          setRealPlanState('ready')
          return { status: 'ok', source: 'google-maps', itinerary: serializePlanData(realPlan, realPlan.stops, realPlan.totalWalkingMinutes) }
        } catch (error) {
          return { status: 'error', message: getGoogleErrorMessage(error), itinerary: serializePlan() }
        }
      }
      const requestedKind = typeof input.kind === 'string' ? input.kind : undefined
      return {
        status: 'ok',
        source: 'mock',
        message: 'Google Maps is not configured; simulated data was returned.',
        places: effectiveStops
          .filter((stop) => !requestedKind || stop.place.kind === requestedKind)
          .map((stop) => ({ id: stop.place.id, name: stop.place.name, kind: stop.place.kind, availability: stop.place.availability })),
      }
    },
    getPlaceStatus(input) {
      const stop = findToolStop(input)
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
      return { status: 'ok', route: stop.walkFromPrevious, source: plan.source ?? 'mock' }
    },
    getItinerary: serializePlan,
    proposeItinerary(input) {
      const requestedIntent = typeof input.intent === 'string' ? input.intent : intent
      setNotice('An agent prepared a proposal visible on the current plan.')
      return { status: 'proposal', intent: requestedIntent, itinerary: serializePlan(), applied: false }
    },
    replaceStop(input) {
      const stop = findToolStop(input)
      if (!stop) throw new Error('STOP_NOT_FOUND')
      if (!usingMockRepair || stop.id !== MOCK_ALTERNATIVE.replacesStopId) {
        return { status: 'unavailable', message: 'This phase only has a simulated replacement for the culture stop.' }
      }
      const shouldApply = input.apply === true
      if (shouldApply) applyReplacement()
      else setNotice('An agent proposed replacing the stop; it has not been applied yet.')
      return {
        status: shouldApply ? 'applied' : 'proposal',
        replacedStopId: stop.id,
        replacement: MOCK_ALTERNATIVE.place,
        applied: shouldApply,
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
    setOrigin(input) {
      const locationId = typeof input.locationId === 'string' ? input.locationId : ''
      if (locationId === 'current-location') return { status: 'needs_user_consent', message: 'The person must authorize device location access.' }
      const location = MOCK_LOCATIONS.find((item) => item.id === locationId)
      if (!location) throw new Error('LOCATION_NOT_FOUND')
      changeLocation(locationId)
      return { status: 'ok', origin: { id: location.id, name: location.name, detail: location.detail } }
    },
    updateIntent(input) {
      const nextIntent = typeof input.intent === 'string' ? input.intent.trim() : ''
      if (!nextIntent) throw new Error('INTENT_REQUIRED')
      setIntent(nextIntent)
      setNotice('Intent updated by an agent; the plan has not been recalculated yet.')
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
        mapSource: plan.source ?? 'mock',
        origin: plan.origin.name,
        stopCount: effectiveStops.length,
        manualControlsAvailable: true,
      }
    },
  }

  const webmcp = useWebMcp(webMcpActions)

  return (
    <main className={`app-shell ${mapState === 'ready' ? 'has-real-map' : ''}`}>
      <section className={`map-stage ${mapState === 'ready' ? 'is-google-map' : ''}`} aria-label={mapState === 'ready' ? 'Real route map' : 'Simulated route map'}>
        <div ref={mapContainerRef} className={`google-map-canvas ${mapState === 'ready' ? 'is-visible' : 'is-hidden'}`} aria-hidden={mapState !== 'ready'} />
        <div className="map-grid" aria-hidden="true" />
        <svg className="map-streets" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-5 24 C24 17 41 33 105 12" />
          <path d="M-8 77 C19 58 42 83 108 63" />
          <path d="M19 -5 C24 26 18 52 39 105" />
          <path d="M68 -4 C59 27 83 52 70 105" />
          <path d="M-4 50 C31 43 65 56 105 43" />
        </svg>
        <svg className="map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={routePoints} />
        </svg>

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
          {plan.origin.name}
          <small>{plan.origin.detail}</small>
        </div>

        {mapState !== 'ready' && (
          <>
            <div
              className="map-marker map-origin"
              style={{ left: `${plan.origin.x}%`, top: `${plan.origin.y}%` }}
              aria-label={`Starting point: ${plan.origin.name}`}
            >
              <span className="origin-ping" />
              <span className="origin-core" />
            </div>

            {effectiveStops.map((stop) => {
              const isClosed = stop.place.availability === 'closed'
              const isCurrent = currentStop?.id === stop.id
              return (
                <div
                  className={`map-marker map-stop ${isClosed ? 'is-closed' : ''} ${isCurrent ? 'is-current' : ''}`}
                  key={stop.id}
                  style={{ left: `${stop.place.x}%`, top: `${stop.place.y}%` }}
                  aria-label={`${stop.sequence}. ${stop.place.name}`}
                >
                  <span className="stop-pin">{stop.sequence}</span>
                  <span className="map-stop-name">{stop.place.name}</span>
                </div>
              )
            })}
          </>
        )}

        <div className="map-footer">
          <div>
            <strong>{effectiveStops.length} stops</strong>
            <span>·</span>
            <strong>{totalWalkingMinutes} min walking</strong>
          </div>
          <span>
            {plan.source === 'google-maps'
              ? `${plan.checkedAt ?? 'Google Maps'}${plan.routeWarnings?.length ? ' · Review warnings' : ''}`
              : mapError || 'Simulated fallback · add a key for real data'}
          </span>
        </div>
      </section>

      <section className="plan-sheet" aria-labelledby="plan-title">
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="plan-content">
          <header className="plan-header">
            <div>
              <p className="eyebrow">Your plan for this afternoon</p>
              <h1 id="plan-title">{plan.title}</h1>
            <p className="plan-location">{plan.city} · {totalWalkingMinutes} min walking</p>
            </div>
            <span className={`plan-status ${plan.source === 'google-maps' ? 'is-real' : ''}`}>
              {plan.source === 'google-maps' ? 'Real' : 'Mock'}
            </span>
          </header>

          <form className="intent-form" onSubmit={submitIntent}>
            <label htmlFor="intent">What do you want to do?</label>
            <textarea
              id="intent"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              rows={3}
            />
            <button className="primary-button" type="submit">
              Update intent <span aria-hidden="true">↗</span>
            </button>
          </form>

          <section className="location-card" aria-labelledby="location-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Starting point</p>
                <h2 id="location-title">Where are you starting?</h2>
              </div>
              <span className="location-icon" aria-hidden="true">⌖</span>
            </div>
            <select
              aria-label="Select starting point"
              value={selectedLocationId}
              onChange={(event) => changeLocation(event.target.value)}
            >
              {selectedLocationId === 'current-location' && (
                <option value="current-location">My current location · device</option>
              )}
              {MOCK_LOCATIONS.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} · {location.detail}
                </option>
              ))}
            </select>
            <div className="location-actions">
              <button className="text-button" type="button" onClick={requestDeviceLocation} disabled={locationState === 'requesting'}>
                <span aria-hidden="true">◎</span> {locationState === 'requesting' ? 'Waiting for permission…' : 'Use my real location'}
              </button>
              <button className="text-button secondary" type="button" onClick={useSimulatedLocation}>
                Use simulated location
              </button>
            </div>
            {mapsApiKey ? (
              <button className="real-search-button" type="button" onClick={() => void searchRealPlan()} disabled={realPlanState === 'loading'}>
                <span>{realPlanState === 'loading' ? 'Querying Google Maps…' : 'Find real places nearby'}</span>
                <span aria-hidden="true">↗</span>
              </button>
            ) : (
              <p className="key-hint">To activate the real map, configure <code>VITE_GOOGLE_MAPS_API_KEY</code>.</p>
            )}
          </section>

          {notice && <p className="notice" aria-live="polite">{notice}</p>}
          {locationState === 'denied' && <p className="state-hint">Location permission denied: continuing with the manual point.</p>}
          {locationState === 'unsupported' && <p className="state-hint">This browser does not expose geolocation: continuing with the manual point.</p>}

          {currentStop && (
            <section className="next-stop-card" aria-labelledby="next-stop-title">
              <div className="next-stop-topline">
            <p className="section-kicker">Next stop</p>
                <span>{currentStop.sequence.toString().padStart(2, '0')} / {effectiveStops.length.toString().padStart(2, '0')}</span>
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

          <section className="stops-section" aria-labelledby="stops-title">
            <div className="section-heading stops-heading">
              <div>
                <p className="section-kicker">Suggested route</p>
                <h2 id="stops-title">{plan.source === 'google-maps' ? 'Places near you' : 'Three relaxed stops'}</h2>
              </div>
              <span className="walking-limit">Max. 20 min / leg</span>
            </div>

            <div className="stops-list">
              {effectiveStops.map((stop, index) => (
                <StopCard
                  key={`${stop.id}-${replacementApplied ? 'replacement' : 'original'}`}
                  stop={stop}
                  isCurrent={currentStop?.id === stop.id}
                  isClosed={stop.place.availability === 'closed'}
                  replacementApplied={usingMockRepair && replacementApplied && stop.id === MOCK_ALTERNATIVE.replacesStopId}
                  onApplyReplacement={applyReplacement}
                  onUndoReplacement={undoReplacement}
                  showWalking={index > 0 || Boolean(stop.walkFromPrevious)}
                />
              ))}
            </div>
          </section>

          <footer className="mock-footer">
            <span className={`mock-dot ${plan.source === 'google-maps' ? 'is-real' : ''}`} />
            <span>
              {plan.source === 'google-maps'
                ? `${plan.checkedAt ?? 'Google Maps'} · Data may change.`
                : `Simulated data for validating the route${mapsApiKey ? '; use the Google Maps button to query real data.' : '.'}`}
            </span>
          </footer>
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
  isClosed: boolean
  replacementApplied: boolean
  onApplyReplacement: () => void
  onUndoReplacement: () => void
  showWalking: boolean
}

function StopCard({
  stop,
  isCurrent,
  isClosed,
  replacementApplied,
  onApplyReplacement,
  onUndoReplacement,
  showWalking,
  }: StopCardProps) {
  const place: TripPlace = stop.place

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
            <span className={`availability availability-${place.availability}`}>
              {place.availabilityLabel}
            </span>
          </div>
          <h3>{place.name}</h3>
          <p>{place.summary}</p>
          <div className="stop-card-details">
            <span>{place.address}</span>
            <span>{place.checkedAt}</span>
          </div>
          {place.mapsUrl && (
            <a className="maps-link" href={place.mapsUrl} target="_blank" rel="noreferrer">
              View on Google Maps ↗
            </a>
          )}

          {isClosed && !replacementApplied && (
            <div className="repair-box">
              <div>
                <strong>This stop changed</strong>
                <span>We found a cultural replacement 7 min away.</span>
              </div>
              <button className="repair-button" type="button" onClick={onApplyReplacement}>
                View replacement <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}

          {replacementApplied && (
            <div className="replacement-box">
              <div>
                <strong>Replacement applied</strong>
                <span>{MOCK_ALTERNATIVE.reason}</span>
              </div>
              <button className="undo-button" type="button" onClick={onUndoReplacement}>Undo</button>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}

export default App
