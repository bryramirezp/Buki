import { describe, expect, it } from 'vitest'
import {
  BUKI_WEBMCP_TOOLS,
  createRegisteredTool,
  type BukiWebMcpActions,
  type WebMcpCallRecord,
} from './webmcp'

function createActions(getItinerary: BukiWebMcpActions['getItinerary']): BukiWebMcpActions {
  return {
    searchNearbyPlaces: () => ({ status: 'ok' }),
    getPlaceStatus: () => ({ status: 'ok' }),
    computeWalkingRoute: () => ({ status: 'ok' }),
    getItinerary,
    planWalk: () => ({ status: 'ok' }),
    focusStop: () => ({ status: 'ok' }),
    setOrigin: () => ({ status: 'ok' }),
    updateIntent: () => ({ status: 'ok' }),
    advanceToNextStop: () => ({ status: 'ok' }),
    getBukiContext: () => ({ status: 'ok' }),
  }
}

function getDefinition(name: typeof BUKI_WEBMCP_TOOLS[number]['name']) {
  const definition = BUKI_WEBMCP_TOOLS.find((tool) => tool.name === name)
  if (!definition) throw new Error(`Missing ${name}`)
  return definition
}

describe('Buki WebMCP tools', () => {
  it('uses the latest actions when a registered tool executes', async () => {
    const calls: Array<Omit<WebMcpCallRecord, 'id' | 'timestamp'>> = []
    const actionsRef = { current: createActions(() => ({ status: 'needs_origin' })) }
    const tool = createRegisteredTool(getDefinition('get_itinerary'), actionsRef, (call) => calls.push(call))

    await expect(tool.execute({})).resolves.toEqual({ status: 'needs_origin' })

    actionsRef.current = createActions(() => ({ status: 'ok', stops: ['real-stop'] }))
    await expect(tool.execute({})).resolves.toEqual({ status: 'ok', stops: ['real-stop'] })
    expect(calls).toEqual([
      expect.objectContaining({ name: 'get_itinerary', status: 'success' }),
      expect.objectContaining({ name: 'get_itinerary', status: 'success' }),
    ])
  })

  it('rejects tool failures after recording them', async () => {
    const calls: Array<Omit<WebMcpCallRecord, 'id' | 'timestamp'>> = []
    const actionsRef = { current: createActions(() => { throw new Error('PLAN_UNAVAILABLE') }) }
    const tool = createRegisteredTool(getDefinition('get_itinerary'), actionsRef, (call) => calls.push(call))

    await expect(tool.execute({})).rejects.toThrow('PLAN_UNAVAILABLE')
    expect(calls).toEqual([expect.objectContaining({ name: 'get_itinerary', status: 'error' })])
  })

  it('keeps schemas and annotations honest', () => {
    const names = BUKI_WEBMCP_TOOLS.map((tool) => tool.name)
    const search = getDefinition('search_nearby_places')
    const route = getDefinition('compute_walking_route')

    expect(names).toContain('plan_walk')
    expect(names).not.toContain('propose_itinerary')
    expect(names).not.toContain('replace_stop')
    expect(search.annotations).toEqual({ untrustedContentHint: true })
    expect(route.inputSchema.properties).toHaveProperty('toPlaceId')
    expect(route.inputSchema.properties).not.toHaveProperty('fromPlaceId')
  })
})
