import { useEffect, useState } from 'react'
import type { TripPlace, TripStop } from './types'
import {
  DEFAULT_INTENT,
  getMockItinerary,
  MOCK_ALTERNATIVE,
  MOCK_LOCATIONS,
} from './data/mockItinerary'

type ServerState = 'mock' | 'checking' | 'online' | 'offline'

const mode = import.meta.env.VITE_BUKI_MODE ?? 'mock'
const apiUrl = import.meta.env.VITE_BUKI_API_URL ?? ''
const isMock = mode === 'mock'

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

function App() {
  const [serverState, setServerState] = useState<ServerState>(isMock ? 'mock' : 'checking')
  const [intent, setIntent] = useState(DEFAULT_INTENT)
  const [selectedLocationId, setSelectedLocationId] = useState('plaza-armas')
  const [plan, setPlan] = useState(() => getMockItinerary())
  const [replacementApplied, setReplacementApplied] = useState(false)
  const [activeStopIndex, setActiveStopIndex] = useState(0)
  const [notice, setNotice] = useState('')

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

  const effectiveStops = plan.stops.map((stop) => {
    if (!replacementApplied || stop.id !== MOCK_ALTERNATIVE.replacesStopId) return stop
    return {
      ...stop,
      place: MOCK_ALTERNATIVE.place,
      walkFromPrevious: MOCK_ALTERNATIVE.walkFromPrevious,
    }
  })

  const availableStops = effectiveStops.filter((stop) => stop.place.availability !== 'closed')
  const currentStop = availableStops[Math.min(activeStopIndex, availableStops.length - 1)]
  const originalAffectedStop = plan.stops.find((stop) => stop.id === MOCK_ALTERNATIVE.replacesStopId)
  const totalWalkingMinutes = replacementApplied && originalAffectedStop
    ? plan.totalWalkingMinutes - originalAffectedStop.walkFromPrevious.minutes + MOCK_ALTERNATIVE.walkFromPrevious.minutes
    : plan.totalWalkingMinutes
  const routePoints = [plan.origin, ...effectiveStops.map((stop) => stop.place)]
    .map((point) => `${point.x},${point.y}`)
    .join(' ')

  const serverLabel = {
    mock: 'Datos simulados',
    checking: 'Comprobando conexión',
    online: 'Funciones conectadas',
    offline: 'Funciones pendientes',
  }[serverState]

  function changeLocation(locationId: string) {
    setSelectedLocationId(locationId)
    setPlan(getMockItinerary(locationId))
    setReplacementApplied(false)
    setActiveStopIndex(0)
    const location = MOCK_LOCATIONS.find((item) => item.id === locationId)
    setNotice(`Punto de partida actualizado: ${location?.name ?? 'ubicación simulada'}.`)
  }

  function useSimulatedLocation() {
    changeLocation('plaza-armas')
    setNotice('Usando tu ubicación simulada cerca de Plaza de Armas.')
  }

  function submitIntent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('Intención guardada. Este plan continúa usando datos simulados.')
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
    <main className="app-shell">
      <section className="map-stage" aria-label="Mapa simulado del recorrido">
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
          <span className="map-mode">{serverLabel}</span>
        </div>

        <div className="map-location-label">
          <span className="pulse-dot" />
          {plan.origin.name}
          <small>{plan.origin.detail}</small>
        </div>

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

        <div className="map-footer">
          <div>
            <strong>{effectiveStops.length} paradas</strong>
            <span>·</span>
            <strong>{totalWalkingMinutes} min caminando</strong>
          </div>
          <span>Ruta conceptual · no son datos reales todavía</span>
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
            <span className="plan-status">Mock</span>
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
              {MOCK_LOCATIONS.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} · {location.detail}
                </option>
              ))}
            </select>
            <button className="text-button" type="button" onClick={useSimulatedLocation}>
              <span aria-hidden="true">◎</span> Usar mi ubicación simulada
            </button>
          </section>

          {notice && <p className="notice" aria-live="polite">{notice}</p>}

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
                <h2 id="stops-title">Tres paradas, sin apuro</h2>
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
                  replacementApplied={replacementApplied && stop.id === MOCK_ALTERNATIVE.replacesStopId}
                  onApplyReplacement={applyReplacement}
                  onUndoReplacement={undoReplacement}
                  showWalking={index > 0 || Boolean(stop.walkFromPrevious)}
                />
              ))}
            </div>
          </section>

          <footer className="mock-footer">
            <span className="mock-dot" />
            <span>Datos simulados para validar el recorrido antes de conectar Google Maps.</span>
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
              {place.availability === 'closed' ? 'Cerrado' : place.availability === 'open' ? 'Abierto' : 'Estado desconocido'}
            </span>
          </div>
          <h3>{place.name}</h3>
          <p>{place.summary}</p>
          <div className="stop-card-details">
            <span>{place.address}</span>
            <span>{place.checkedAt}</span>
          </div>

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
