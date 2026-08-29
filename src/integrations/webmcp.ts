import type { InputSchema, ModelContextTool, WebMcpToolAnnotations } from '@mcp-b/webmcp-types'

export type WebMcpToolName =
  | 'search_nearby_places'
  | 'get_place_status'
  | 'compute_walking_route'
  | 'get_itinerary'
  | 'plan_walk'
  | 'focus_stop'
  | 'set_origin'
  | 'update_intent'
  | 'advance_to_next_stop'
  | 'get_buki_context'

export interface WebMcpToolDefinition {
  name: WebMcpToolName
  title: string
  description: string
  inputSchema: InputSchema
  annotations?: WebMcpToolAnnotations
}

export type RegisteredBukiTool = Omit<ModelContextTool<Record<string, unknown>, unknown, WebMcpToolName>, 'inputSchema'> & {
  inputSchema: InputSchema
}

export interface WebMcpCallRecord {
  id: string
  name: WebMcpToolName
  status: 'success' | 'error'
  summary: string
  timestamp: string
}

export interface BukiWebMcpActions {
  searchNearbyPlaces: (input: Record<string, unknown>) => Promise<unknown> | unknown
  getPlaceStatus: (input: Record<string, unknown>) => Promise<unknown> | unknown
  computeWalkingRoute: (input: Record<string, unknown>) => Promise<unknown> | unknown
  getItinerary: () => Promise<unknown> | unknown
  planWalk: (input: Record<string, unknown>) => Promise<unknown> | unknown
  focusStop: (input: Record<string, unknown>) => Promise<unknown> | unknown
  setOrigin: (input: Record<string, unknown>) => Promise<unknown> | unknown
  updateIntent: (input: Record<string, unknown>) => Promise<unknown> | unknown
  advanceToNextStop: () => Promise<unknown> | unknown
  getBukiContext: () => Promise<unknown> | unknown
}

export const BUKI_WEBMCP_TOOLS: readonly WebMcpToolDefinition[] = [
  {
    name: 'search_nearby_places',
    title: 'Search nearby places',
    description: 'Builds a new real nearby route from the current origin, optionally filtered by category and search radius. The new route becomes visible in Buki.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['food', 'culture', 'view'], description: 'Interest category.' },
        radiusMeters: { type: 'integer', minimum: 100, maximum: 50000, description: 'Search radius in meters.' },
      },
      additionalProperties: false,
    },
    annotations: { untrustedContentHint: true },
  },
  {
    name: 'get_place_status',
    title: 'Get place status',
    description: 'Returns the availability, address, and check time for a stop in the plan.',
    inputSchema: {
      type: 'object',
      properties: {
        placeId: { type: 'string', description: 'Stop identifier.' },
      },
      required: ['placeId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'compute_walking_route',
    title: 'Compute walking route',
    description: 'Returns the planned walking leg that leads to a stop in the current route.',
    inputSchema: {
      type: 'object',
      properties: {
        toPlaceId: { type: 'string', description: 'Leg destination.' },
      },
      required: ['toPlaceId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_itinerary',
    title: 'Get current itinerary',
    description: 'Reads the current route, its stops, statuses, times, and data source.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'plan_walk',
    title: 'Build a walking plan',
    description: 'Uses the LLM to interpret a person’s intent, then uses Google Maps to build and display a real walking plan in Buki.',
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'What the person wants to do.' },
      },
      required: ['intent'],
      additionalProperties: false,
    },
    annotations: { untrustedContentHint: true },
  },
  {
    name: 'focus_stop',
    title: 'Focus stop',
    description: 'Moves the next-stop card to a specific stop in the route.',
    inputSchema: {
      type: 'object',
      properties: {
        stopId: { type: 'string', description: 'Stop identifier.' },
      },
      required: ['stopId'],
      additionalProperties: false,
    },
    annotations: { untrustedContentHint: true },
  },
  {
    name: 'set_origin',
    title: 'Set starting point',
    description: 'Changes the plan origin to a real latitude and longitude selected by the person or agent.',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', minimum: -90, maximum: 90, description: 'Latitude of the selected starting point.' },
        longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Longitude of the selected starting point.' },
      },
      required: ['latitude', 'longitude'],
      additionalProperties: false,
    },
    annotations: { untrustedContentHint: true },
  },
  {
    name: 'update_intent',
    title: 'Update intent',
    description: 'Updates the intent text visible to the person without inventing a new plan.',
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'The person’s new intent.' },
      },
      required: ['intent'],
      additionalProperties: false,
    },
  },
  {
    name: 'advance_to_next_stop',
    title: 'Advance to next stop',
    description: 'Marks the current leg as started and focuses the next available stop.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { untrustedContentHint: true },
  },
  {
    name: 'get_buki_context',
    title: 'Get Buki context',
    description: 'Returns a summary of Buki, WebMCP availability, and the plan data source.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
]

const ACTIONS_BY_TOOL: Record<WebMcpToolName, keyof BukiWebMcpActions> = {
  search_nearby_places: 'searchNearbyPlaces',
  get_place_status: 'getPlaceStatus',
  compute_walking_route: 'computeWalkingRoute',
  get_itinerary: 'getItinerary',
  plan_walk: 'planWalk',
  focus_stop: 'focusStop',
  set_origin: 'setOrigin',
  update_intent: 'updateIntent',
  advance_to_next_stop: 'advanceToNextStop',
  get_buki_context: 'getBukiContext',
}

function summarizeResult(result: unknown) {
  if (typeof result === 'string') return result.slice(0, 120)
  if (result && typeof result === 'object' && 'status' in result) return String(result.status)
  return 'Result delivered to the agent'
}

export function createRegisteredTool(
  definition: WebMcpToolDefinition,
  actionsRef: { current: BukiWebMcpActions },
  onCall: (record: Omit<WebMcpCallRecord, 'id' | 'timestamp'>) => void,
): RegisteredBukiTool {
  const actionName = ACTIONS_BY_TOOL[definition.name]

  return {
    ...definition,
    async execute(input) {
      try {
        const result = await actionsRef.current[actionName](input)
        onCall({ name: definition.name, status: 'success', summary: summarizeResult(result) })
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool execution failed'
        onCall({ name: definition.name, status: 'error', summary: message.slice(0, 120) })
        throw error instanceof Error ? error : new Error(message)
      }
    },
  }
}
