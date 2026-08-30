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
  checking: 'Checking compatibility…',
  active: 'WebMCP is active on this page',
  partial: 'WebMCP is partially registered',
  unavailable: 'WebMCP is unavailable in this browser',
  error: 'The tools could not be registered',
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function schemaFields(schema: unknown) {
  if (!schema || typeof schema !== 'object') return 'Schema unavailable'
  const properties = (schema as { properties?: unknown }).properties
  if (!properties || typeof properties !== 'object') return 'No parameters'
  const fields = Object.keys(properties)
  return fields.length ? fields.map((field) => ` ${field}`).join(' ·') : 'No parameters'
}

function registeredSchema(tool: RegisteredTool | undefined) {
  if (!tool?.inputSchema) return undefined
  if (typeof tool.inputSchema !== 'string') return tool.inputSchema
  try {
    const parsed: unknown = JSON.parse(tool.inputSchema)
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
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

  const registeredByName = new Map(registeredTools.map((tool) => [tool.name, tool]))

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
            <p className="section-kicker">Agent connection</p>
            <h2 id="webmcp-inspector-title">WebMCP Inspector</h2>
            <p>{STATUS_LABELS[status]}</p>
          </div>
          <button className="webmcp-close" type="button" onClick={onClose} aria-label="Close inspector">×</button>
        </header>

        <div className="webmcp-summary">
          <span className={`webmcp-status-dot is-${status}`} />
          <strong>{registeredCount} / {definitions.length} registered</strong>
          <span>{status === 'active' ? 'Available to a compatible agent' : 'This view remains available for inspection'}</span>
        </div>

        <div className="webmcp-tool-list">
          {definitions.map((tool) => {
            const registeredTool = registeredByName.get(tool.name)
            const registered = Boolean(registeredTool)
            const schema = registeredSchema(registeredTool) ?? tool.inputSchema
            const annotations = registeredTool?.annotations ?? tool.annotations
            return (
              <article className={`webmcp-tool-card ${registered ? 'is-registered' : ''}`} key={tool.name}>
                <div className="webmcp-tool-topline">
                  <code>{tool.name}</code>
                  <span className={`webmcp-tool-state ${registered ? 'is-registered' : ''}`}>
                    {registered ? 'Registered' : 'Defined'}
                  </span>
                </div>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
                <div className="webmcp-tool-meta">
                  <span>{registered ? 'Browser parameters:' : 'Local parameters:'}{schemaFields(schema)}</span>
                  <span>Output fields:{schemaFields(tool.outputSchema)}</span>
                  {annotations?.readOnlyHint && <span className="webmcp-readonly">Read-only</span>}
                  {annotations?.untrustedContentHint && <span>Third-party content</span>}
                </div>
              </article>
            )
          })}
        </div>

        <details className="webmcp-call-log" aria-labelledby="webmcp-call-log-title">
          <summary className="webmcp-log-header">
            <div>
              <p className="section-kicker">Activity</p>
              <h3 id="webmcp-call-log-title">Recent calls</h3>
            </div>
            <span className="webmcp-log-summary">{calls.length ? `${calls.length} recorded` : 'No calls yet'}</span>
          </summary>
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
            <p className="webmcp-empty-log">When an agent uses a tool, its summarized result will appear here.</p>
          )}
        </details>

        <footer className="webmcp-modal-footer">
          <span>Actions that change the plan remain visible in Buki.</span>
          <button className="dark-button webmcp-done-button" type="button" onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  )
}
