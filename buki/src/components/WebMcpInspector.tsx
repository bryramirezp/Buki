import type { RegisteredTool } from '@mcp-b/webmcp-types'
import type { WebMcpCallRecord, WebMcpToolDefinition } from '../integrations/webmcp'
import type { WebMcpStatus } from '../hooks/useWebMcp'

interface WebMcpInspectorProps {
  open: boolean
  onClose: () => void
  status: WebMcpStatus
  definitions: readonly WebMcpToolDefinition[]
  registeredTools: RegisteredTool[]
  registeredCount: number
  calls: WebMcpCallRecord[]
}

const STATUS_LABELS: Record<WebMcpStatus, string> = {
  checking: 'Comprobando compatibilidad…',
  active: 'WebMCP activo en esta página',
  partial: 'WebMCP parcialmente registrado',
  unavailable: 'WebMCP no disponible en este navegador',
  error: 'No se pudieron registrar las herramientas',
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function schemaFields(schema: WebMcpToolDefinition['inputSchema']) {
  const properties = schema.properties
  if (!properties || typeof properties !== 'object') return 'Sin parámetros'
  const fields = Object.keys(properties)
  return fields.length ? fields.map((field) => ` ${field}`).join(' ·') : 'Sin parámetros'
}

export function WebMcpInspector({
  open,
  onClose,
  status,
  definitions,
  registeredTools,
  registeredCount,
  calls,
}: WebMcpInspectorProps) {
  if (!open) return null

  const registeredNames = new Set(registeredTools.map((tool) => tool.name))

  return (
    <div className="webmcp-overlay" role="presentation" onClick={onClose}>
      <section
        className="webmcp-modal voyage-modal voyage-inspector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="webmcp-inspector-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="webmcp-modal-header">
          <div>
            <p className="section-kicker">Conexión de agente</p>
            <h2 id="webmcp-inspector-title">Inspector WebMCP</h2>
            <p>{STATUS_LABELS[status]}</p>
          </div>
          <button className="webmcp-close" type="button" onClick={onClose} aria-label="Cerrar inspector">×</button>
        </header>

        <div className="webmcp-summary">
          <span className={`webmcp-status-dot is-${status}`} />
          <strong>{registeredCount} / {definitions.length} registradas</strong>
          <span>{status === 'active' ? 'Disponibles para un agente compatible' : 'La vista permanece disponible para inspección'}</span>
        </div>

        <div className="webmcp-tool-list">
          {definitions.map((tool) => {
            const registered = registeredNames.has(tool.name)
            return (
              <article className={`webmcp-tool-card ${registered ? 'is-registered' : ''}`} key={tool.name}>
                <div className="webmcp-tool-topline">
                  <code>{tool.name}</code>
                  <span className={`webmcp-tool-state ${registered ? 'is-registered' : ''}`}>
                    {registered ? 'Registrada' : 'Definida'}
                  </span>
                </div>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
                <div className="webmcp-tool-meta">
                  <span>Parámetros:{schemaFields(tool.inputSchema)}</span>
                  {tool.annotations?.readOnlyHint && <span className="webmcp-readonly">Solo lectura</span>}
                </div>
              </article>
            )
          })}
        </div>

        <section className="webmcp-call-log" aria-labelledby="webmcp-call-log-title">
          <div className="webmcp-log-header">
            <div>
              <p className="section-kicker">Actividad</p>
              <h3 id="webmcp-call-log-title">Últimas invocaciones</h3>
            </div>
            <span>{calls.length ? `${calls.length} registradas` : 'Sin invocaciones'}</span>
          </div>
          {calls.length ? (
            <div className="webmcp-call-list">
              {calls.map((call) => (
                <div className="webmcp-call-row" key={call.id}>
                  <span className={`webmcp-call-dot is-${call.status}`} />
                  <code>{call.name}</code>
                  <span>{call.summary}</span>
                  <time>{formatTime(call.timestamp)}</time>
                </div>
              ))}
            </div>
          ) : (
            <p className="webmcp-empty-log">Cuando un agente use una herramienta, aparecerá aquí el resultado resumido.</p>
          )}
        </section>

        <footer className="webmcp-modal-footer">
          <span>Las acciones que cambian el plan quedan visibles en Buki.</span>
          <button className="dark-button webmcp-done-button" type="button" onClick={onClose}>Listo</button>
        </footer>
      </section>
    </div>
  )
}
