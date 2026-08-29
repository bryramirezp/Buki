import { useEffect, useRef, useState } from 'react'
import type { ModelContext, RegisteredTool } from '@mcp-b/webmcp-types'
import {
  BUKI_WEBMCP_TOOLS,
  createRegisteredTool,
  type BukiWebMcpActions,
  type WebMcpCallRecord,
} from '../integrations/webmcp'

export type WebMcpStatus = 'checking' | 'active' | 'partial' | 'unavailable' | 'error'

function createCallRecord(record: Omit<WebMcpCallRecord, 'id' | 'timestamp'>): WebMcpCallRecord {
  return {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  }
}

export function useWebMcp(actions: BukiWebMcpActions) {
  const actionsRef = useRef(actions)
  const [status, setStatus] = useState<WebMcpStatus>('checking')
  const [registeredTools, setRegisteredTools] = useState<RegisteredTool[]>([])
  const [registeredCount, setRegisteredCount] = useState(0)
  const [calls, setCalls] = useState<WebMcpCallRecord[]>([])

  actionsRef.current = actions

  useEffect(() => {
    const detectedModelContext = document.modelContext
    if (!detectedModelContext || typeof detectedModelContext.registerTool !== 'function') {
      setStatus('unavailable')
      return
    }
    const modelContext: ModelContext = detectedModelContext
    const runtimeModelContext = modelContext as ModelContext & {
      addEventListener?: EventTarget['addEventListener']
      removeEventListener?: EventTarget['removeEventListener']
      getTools?: ModelContext['getTools']
    }

    let disposed = false
    const controller = new AbortController()
    const recordCall = (record: Omit<WebMcpCallRecord, 'id' | 'timestamp'>) => {
      setCalls((current) => [createCallRecord(record), ...current].slice(0, 12))
    }

    async function refreshRegisteredTools() {
      if (typeof runtimeModelContext.getTools !== 'function') return
      try {
        const discovered = await runtimeModelContext.getTools()
        if (disposed) return
        const knownNames = new Set(BUKI_WEBMCP_TOOLS.map((tool) => tool.name))
        setRegisteredTools(discovered.filter((tool) => knownNames.has(tool.name as typeof BUKI_WEBMCP_TOOLS[number]['name'])))
      } catch {
        if (!disposed) setRegisteredTools([])
      }
    }

    const handleToolChange = () => {
      void refreshRegisteredTools()
    }
    runtimeModelContext.addEventListener?.('toolchange', handleToolChange)

    async function registerTools() {
      let count = 0
      for (const definition of BUKI_WEBMCP_TOOLS) {
        try {
          await document.modelContext!.registerTool(
            createRegisteredTool(definition, actionsRef, recordCall),
            { signal: controller.signal },
          )
          count += 1
          if (!disposed) {
            setRegisteredCount(count)
            setRegisteredTools((current) => current.some((tool) => tool.name === definition.name)
              ? current
              : [...current, {
                name: definition.name,
                title: definition.title,
                description: definition.description,
                inputSchema: definition.inputSchema,
                window,
                origin: window.location.origin,
                annotations: definition.annotations,
              }])
          }
        } catch {
          // A duplicate during hot reload should not prevent the remaining tools from registering.
        }
      }

      if (disposed) return
      await refreshRegisteredTools()
      setStatus(count === BUKI_WEBMCP_TOOLS.length ? 'active' : count > 0 ? 'partial' : 'error')
    }

    void registerTools()

    return () => {
      disposed = true
      runtimeModelContext.removeEventListener?.('toolchange', handleToolChange)
      controller.abort()
    }
  }, [])

  return {
    status,
    definitions: BUKI_WEBMCP_TOOLS,
    registeredTools,
    registeredCount,
    calls,
  }
}
