import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { GoogleMapsController } from './integrations/googleMaps'
import {
  buildGoogleTripPlan,
  createGoogleMap,
  moveGoogleMap,
  updateGoogleMapMarkers,
} from './integrations/googleMaps'
import type { TripLocation, TripPlace, TripStop } from './types'
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
  food: 'Comer algo típico',
  culture: 'Cultura',
  view: 'Mirador',
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
    if (error.message === 'GOOGLE_MAPS_KEY_MISSING') return 'Falta configurar la clave de Google Maps para buscar datos reales.'
    if (error.message === 'GOOGLE_MAPS_NOT_ENOUGH_PLACES') return 'Google Maps no encontró suficientes lugares cercanos para armar el circuito.'
    if (error.message.includes('REQUEST_DENIED') || error.message.includes('ApiNotActivated')) {
      return 'Google Maps rechazó la solicitud. Revisa APIs activadas, restricciones y facturación de la clave.'
    }
  }
  return 'No pudimos consultar Google Maps ahora. El recorrido simulado sigue disponible.'
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
    mock: 'Funciones simuladas',
    checking: 'Comprobando conexión',
    online: 'Funciones conectadas',
    offline: 'Funciones pendientes',
  }[serverState]

  const mapLabel = mapState === 'ready'
    ? plan.source === 'google-maps' ? 'Google Maps · real' : 'Google Maps listo'
    : mapState === 'loading'
      ? 'Cargando Google Maps'
      : mapState === 'error'
        ? 'Mock · Maps no disponible'
        : 'Mock · sin clave de Maps'

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
    setNotice(`Punto de partida actualizado: ${nextLocation.name}.`)
  }

  function useSimulatedLocation() {
    changeLocation('plaza-armas')
    setLocationState('simulated')
    setNotice('Usando tu ubicación simulada cerca de Plaza de Armas.')
  }

  function requestDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationState('unsupported')
      setNotice('Este navegador no permite consultar tu ubicación. Puedes elegir un punto manual.')
      return
    }

    setLocationState('requesting')
    setNotice('Esperando permiso para consultar tu ubicación…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextOrigin: TripLocation = {
          id: 'current-location',
          name: 'Mi ubicación actual',
          detail: 'Ubicación del dispositivo',
          x: 48,
          y: 53,
          coordinates: { lat: coords.latitude, lng: coords.longitude },
        }
        setLocationState('granted')
        setSelectedLocationId(nextOrigin.id)
        setOrigin(nextOrigin)
        setPlan({ ...getMockItinerary(), origin: nextOrigin, city: 'Cerca de ti' })
        setReplacementApplied(false)
        setActiveStopIndex(0)
        setRealPlanState('idle')
        if (googleMapRef.current && nextOrigin.coordinates) moveGoogleMap(googleMapRef.current, nextOrigin.coordinates)
        setNotice('Ubicación confirmada. Ahora puedes buscar lugares reales cerca de ti.')
      },
      () => {
        setLocationState('denied')
        setNotice('No se concedió el permiso de ubicación. Puedes elegir un punto manual o usar la ubicación simulada.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  async function searchRealPlan() {
    if (!mapsApiKey) {
      setNotice('Agrega VITE_GOOGLE_MAPS_API_KEY en tu entorno local para consultar lugares reales.')
      return
    }
    if (!origin.coordinates) {
      setNotice('Confirma un punto de partida antes de buscar lugares reales.')
      return
    }

    setRealPlanState('loading')
    setNotice('Consultando lugares, horarios y ruta caminable…')
    try {
      const controller = await ensureGoogleMap(origin.coordinates)
      const realPlan = await buildGoogleTripPlan(
        controller,
        origin,
        'Una ruta para explorar ahora',
        origin.detail,
      )
      setPlan(realPlan)
      setReplacementApplied(false)
      setActiveStopIndex(0)
      setRealPlanState('ready')
      setNotice(realPlan.routeWarnings?.length
        ? 'Plan real listo. Revisa la advertencia de caminata en la ruta.'
        : `Plan real listo con ${realPlan.stops.length} lugares cercanos.`)
    } catch (error) {
      setRealPlanState('error')
      setNotice(getGoogleErrorMessage(error))
    }
  }

  function submitIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(plan.source === 'google-maps'
      ? 'Intención actualizada. Vuelve a buscar lugares reales para aplicar nuevos criterios.'
      : 'Intención guardada. Este plan continúa usando datos simulados.')
  }

  function moveToNextStop() {
    if (activeStopIndex >= availableStops.length - 1) {
      setNotice('Llegaste al final del circuito. Puedes volver a cualquier parada del plan.')
      return
    }
    const nextIndex = activeStopIndex + 1
    setActiveStopIndex(nextIndex)
    setNotice(`Siguiente: ${availableStops[nextIndex].place.name}.`)
  }

  function applyReplacement() {
    setReplacementApplied(true)
    setNotice(`Reemplazo aplicado: ${MOCK_ALTERNATIVE.place.name}.`)
  }

  function undoReplacement() {
    setReplacementApplied(false)
    setNotice('Reemplazo deshecho. La parada original vuelve a estar marcada como cerrada.')
  }

  return (
    <main className={`app-shell ${mapState === 'ready' ? 'has-real-map' : ''}`}>
      <section className={`map-stage ${mapState === 'ready' ? 'is-google-map' : ''}`} aria-label={mapState === 'ready' ? 'Mapa real del recorrido' : 'Mapa simulado del recorrido'}>
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
          <span className="map-mode">{mapLabel}</span>
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
              aria-label={`Punto de partida: ${plan.origin.name}`}
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
            <strong>{effectiveStops.length} paradas</strong>
            <span>·</span>
            <strong>{totalWalkingMinutes} min caminando</strong>
          </div>
          <span>
            {plan.source === 'google-maps'
              ? `${plan.checkedAt ?? 'Google Maps'}${plan.routeWarnings?.length ? ' · Revisa advertencias' : ''}`
              : mapError || 'Fallback simulado · agrega una clave para datos reales'}
          </span>
        </div>
      </section>

      <section className="plan-sheet" aria-labelledby="plan-title">
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="plan-content">
          <header className="plan-header">
            <div>
              <p className="eyebrow">Tu plan de esta tarde</p>
              <h1 id="plan-title">{plan.title}</h1>
              <p className="plan-location">{plan.city} · {totalWalkingMinutes} min de caminata</p>
            </div>
            <span className={`plan-status ${plan.source === 'google-maps' ? 'is-real' : ''}`}>
              {plan.source === 'google-maps' ? 'Real' : 'Mock'}
            </span>
          </header>

          <form className="intent-form" onSubmit={submitIntent}>
            <label htmlFor="intent">¿Qué quieres hacer?</label>
            <textarea
              id="intent"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              rows={3}
            />
            <button className="primary-button" type="submit">
              Actualizar intención <span aria-hidden="true">↗</span>
            </button>
          </form>

          <section className="location-card" aria-labelledby="location-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Punto de partida</p>
                <h2 id="location-title">¿Desde dónde sales?</h2>
              </div>
              <span className="location-icon" aria-hidden="true">⌖</span>
            </div>
            <select
              aria-label="Seleccionar punto de partida"
              value={selectedLocationId}
              onChange={(event) => changeLocation(event.target.value)}
            >
              {selectedLocationId === 'current-location' && (
                <option value="current-location">Mi ubicación actual · dispositivo</option>
              )}
              {MOCK_LOCATIONS.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} · {location.detail}
                </option>
              ))}
            </select>
            <div className="location-actions">
              <button className="text-button" type="button" onClick={requestDeviceLocation} disabled={locationState === 'requesting'}>
                <span aria-hidden="true">◎</span> {locationState === 'requesting' ? 'Esperando permiso…' : 'Usar mi ubicación real'}
              </button>
              <button className="text-button secondary" type="button" onClick={useSimulatedLocation}>
                Usar ubicación simulada
              </button>
            </div>
            {mapsApiKey ? (
              <button className="real-search-button" type="button" onClick={() => void searchRealPlan()} disabled={realPlanState === 'loading'}>
                <span>{realPlanState === 'loading' ? 'Consultando Google Maps…' : 'Buscar lugares reales cerca'}</span>
                <span aria-hidden="true">↗</span>
              </button>
            ) : (
              <p className="key-hint">Para activar el mapa real, configura <code>VITE_GOOGLE_MAPS_API_KEY</code>.</p>
            )}
          </section>

          {notice && <p className="notice" aria-live="polite">{notice}</p>}
          {locationState === 'denied' && <p className="state-hint">Permiso de ubicación denegado: seguimos con el punto manual.</p>}
          {locationState === 'unsupported' && <p className="state-hint">Este navegador no expone geolocalización: seguimos con el punto manual.</p>}

          {currentStop && (
            <section className="next-stop-card" aria-labelledby="next-stop-title">
              <div className="next-stop-topline">
                <p className="section-kicker">Siguiente parada</p>
                <span>{currentStop.sequence.toString().padStart(2, '0')} / {effectiveStops.length.toString().padStart(2, '0')}</span>
              </div>
              <h2 id="next-stop-title">{currentStop.place.name}</h2>
              <p>{currentStop.place.summary}</p>
              <div className="next-stop-meta">
                <span>{currentStop.walkFromPrevious.minutes} min desde aquí</span>
                <span>{formatDistance(currentStop.walkFromPrevious.meters)}</span>
              </div>
              <button className="dark-button" type="button" onClick={moveToNextStop}>
                {activeStopIndex >= availableStops.length - 1 ? 'Marcar circuito completo' : 'Empezar este tramo'}
                <span aria-hidden="true">→</span>
              </button>
            </section>
          )}

          <section className="stops-section" aria-labelledby="stops-title">
            <div className="section-heading stops-heading">
              <div>
                <p className="section-kicker">Circuito sugerido</p>
                <h2 id="stops-title">{plan.source === 'google-maps' ? 'Lugares cerca de ti' : 'Tres paradas, sin apuro'}</h2>
              </div>
              <span className="walking-limit">Máx. 20 min / tramo</span>
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
                ? `${plan.checkedAt ?? 'Google Maps'} · Los datos pueden cambiar.`
                : `Datos simulados para validar el recorrido${mapsApiKey ? '; usa el botón de Google Maps para consultar datos reales.' : '.'}`}
            </span>
          </footer>
        </div>
      </section>
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
          <span><strong>{stop.walkFromPrevious.minutes} min</strong> · {formatDistance(stop.walkFromPrevious.meters)} caminando</span>
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
              Ver ficha en Google Maps ↗
            </a>
          )}

          {isClosed && !replacementApplied && (
            <div className="repair-box">
              <div>
                <strong>Esta parada cambió</strong>
                <span>Encontramos un reemplazo cultural a 7 min.</span>
              </div>
              <button className="repair-button" type="button" onClick={onApplyReplacement}>
                Ver reemplazo <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}

          {replacementApplied && (
            <div className="replacement-box">
              <div>
                <strong>Reemplazo aplicado</strong>
                <span>{MOCK_ALTERNATIVE.reason}</span>
              </div>
              <button className="undo-button" type="button" onClick={onUndoReplacement}>Deshacer</button>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}

export default App
