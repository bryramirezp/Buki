import { useEffect, useState } from 'react'

type BackendState = 'mock' | 'checking' | 'online' | 'offline'

const mode = import.meta.env.VITE_BUKI_MODE ?? 'mock'
const apiUrl = import.meta.env.VITE_BUKI_API_URL ?? ''
const isMock = mode === 'mock'

function App() {
  const [backendState, setBackendState] = useState<BackendState>(isMock ? 'mock' : 'checking')

  useEffect(() => {
    if (isMock) return

    const controller = new AbortController()

    fetch(`${apiUrl}/api/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Backend health check failed')
        setBackendState('online')
      })
      .catch(() => {
        if (!controller.signal.aborted) setBackendState('offline')
      })

    return () => controller.abort()
  }, [])

  const backendLabel = {
    mock: 'mock local',
    checking: 'comprobando…',
    online: 'conectado',
    offline: 'pendiente',
  }[backendState]

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <div className="eyebrow">Fase 1 · Base reversible</div>
        <h1 id="page-title">¿Qué puedes hacer ahora?</h1>
        <p className="intro">
          Buki convertirá tu intención y tu ubicación en un plan caminable, realista y adaptable.
        </p>
        <div className="status-row" aria-label="Estado de la aplicación">
          <span className="status-chip">Modo {mode}</span>
          <span className={`status-chip status-${backendState}`}>
            Server-side {backendLabel}
          </span>
        </div>
      </section>

      <section className="setup-card" aria-labelledby="setup-title">
        <div className="card-marker">01</div>
        <div>
          <p className="card-kicker">Punto de partida</p>
          <h2 id="setup-title">La base de Buki está lista</h2>
          <p>
            El frontend y las funciones server-side ya están separados. El siguiente paso es construir
            el recorrido completo con datos simulados antes de conectar Google Maps.
          </p>
          <div className="next-step">Próxima fase: experiencia móvil con datos simulados.</div>
        </div>
      </section>
    </main>
  )
}

export default App
