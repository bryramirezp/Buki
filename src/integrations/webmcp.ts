import type { InputSchema, ModelContextTool, WebMcpToolAnnotations } from '@mcp-b/webmcp-types'

export type WebMcpToolName =
  | 'replan_route'
  | 'get_plan_place_snapshot'
  | 'get_planned_leg'
  | 'get_itinerary'
  | 'plan_walk'
  | 'focus_stop'
  | 'set_origin'
  | 'update_intent'
  | 'advance_to_next_stop'
  | 'propose_stop_repair'
  | 'get_buki_context'

export interface WebMcpToolDefinition {
  name: WebMcpToolName
  title: string
  description: string
  inputSchema: InputSchema
  outputSchema: InputSchema
  annotations?: WebMcpToolAnnotations
}

export type RegisteredBukiTool = Omit<ModelContextTool<Record<string, unknown>, unknown, WebMcpToolName>, 'inputSchema'> & {
  inputSchema: InputSchema
  outputSchema: InputSchema
}

export interface WebMcpCallRecord {
  id: string
  name: WebMcpToolName
  status: 'success' | 'error'
  summary: string
  timestamp: string
}

export interface BukiWebMcpActions {
  replanRoute: (input: Record<string, unknown>) => Promise<unknown> | unknown
  getPlanPlaceSnapshot: (input: Record<string, unknown>) => Promise<unknown> | unknown
  getPlannedLeg: (input: Record<string, unknown>) => Promise<unknown> | unknown
  getItinerary: () => Promise<unknown> | unknown
  planWalk: (input: Record<string, unknown>) => Promise<unknown> | unknown
  focusStop: (input: Record<string, unknown>) => Promise<unknown> | unknown
  setOrigin: (input: Record<string, unknown>) => Promise<unknown> | unknown
  updateIntent: (input: Record<string, unknown>) => Promise<unknown> | unknown
  advanceToNextStop: () => Promise<unknown> | unknown
  proposeStopRepair: (input: Record<string, unknown>) => Promise<unknown> | unknown
  getBukiContext: () => Promise<unknown> | unknown
}

const STATUS_OUTPUT_SCHEMA: InputSchema = {
  type: 'object',
  properties: { status: { type: 'string' } },
  required: ['status'],
  additionalProperties: true,
}

const ITINERARY_OUTPUT_SCHEMA: InputSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    title: { type: 'string' },
    city: { type: 'string' },
    source: { type: 'string' },
    checkedAt: { type: 'string', format: 'date-time' },
    origin: { type: ['object', 'null'] },
    totalWalkingMinutes: { type: 'integer' },
    totalEstimatedMinutes: { type: 'integer' },
    stops: { type: 'array', items: { type: 'object' } },
  },
  required: ['status', 'stops'],
  additionalProperties: true,
}

const REPAIR_PROPOSAL_OUTPUT_SCHEMA: InputSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['proposal_ready'] },
    originalStop: { type: 'object' },
    replacementStop: { type: 'object' },
    affectedLegs: { type: 'object' },
    totalWalkingMinutes: { type: 'integer' },
    totalEstimatedMinutes: { type: 'integer' },
    warnings: { type: 'array', items: { type: 'string' } },
    selectionReason: { type: 'string' },
    requiresUserConfirmation: { type: 'boolean', const: true },
  },
  required: [
    'status',
    'originalStop',
    'replacementStop',
    'affectedLegs',
    'totalWalkingMinutes',
    'totalEstimatedMinutes',
    'requiresUserConfirmation',
  ],
  additionalProperties: false,
}

export const BUKI_WEBMCP_TOOLS: readonly WebMcpToolDefinition[] = [
  {
    name: 'replan_route',
    title: 'Replan current route',
    description: 'Builds and displays a replacement route from the current origin and constraints, optionally filtered by category and search radius. The current route stays visible unless the replacement succeeds.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['food', 'culture', 'view'], description: 'Interest category.' },
        radiusMeters: { type: 'integer', minimum: 100, maximum: 50000, description: 'Search radius in meters.' },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'needs_clarification'] },
        source: { type: 'string', enum: ['google-maps'] },
        itinerary: ITINERARY_OUTPUT_SCHEMA,
        message: { type: 'string' },
      },
      required: ['status'],
      additionalProperties: false,
    },
    annotations: { untrustedContentHint: true },
  },
  {
    name: 'get_plan_place_snapshot',
    title: 'Get plan place snapshot',
    description: 'Returns the availability snapshot captured from Google Maps when the current plan was built. It does not perform a fresh Maps query.',
    inputSchema: {
      type: 'object',
      properties: {
        placeId: { type: 'string', description: 'Stop identifier.' },
      },
      required: ['placeId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        freshness: { type: 'string', enum: ['plan_snapshot'] },
        placeId: { type: 'string' },
        name: { type: 'string' },
        availability: { type: 'string', enum: ['open', 'closed', 'unknown'] },
        availabilityLabel: { type: 'string' },
        capturedAt: { type: 'string', format: 'date-time' },
      },
      required: ['status', 'freshness', 'placeId', 'name', 'availability', 'availabilityLabel', 'capturedAt'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'get_planned_leg',
    title: 'Get planned walking leg',
    description: 'Returns the Google Maps walking leg already calculated for a stop in the current route. It does not calculate a route to arbitrary places.',
    inputSchema: {
      type: 'object',
      properties: {
        toPlaceId: { type: 'string', description: 'Leg destination.' },
      },
      required: ['toPlaceId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        source: { type: 'string', enum: ['google-maps-plan'] },
        route: { type: 'object' },
      },
      required: ['status', 'source', 'route'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_itinerary',
    title: 'Get current itinerary',
    description: 'Reads the current route, its stops, statuses, times, and data source.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: ITINERARY_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'plan_walk',
    title: 'Build a walking plan',
    description: 'Uses the LLM to interpret a person’s intent. If duration or walking comfort is missing, returns the next question without querying Google Maps; otherwise builds and displays a real walking plan in Buki.',
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'What the person wants to do.' },
        availableMinutes: { type: 'integer', minimum: 30, maximum: 720, description: 'Total time the person has for the itinerary.' },
        maxWalkMinutes: { type: 'integer', minimum: 5, maximum: 90, description: 'Maximum comfortable walking time for one leg.' },
      },
      required: ['intent'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'needs_clarification'] },
        intent: { type: 'string' },
        explanation: { type: 'string' },
        itinerary: ITINERARY_OUTPUT_SCHEMA,
        preferences: { type: 'object' },
        nextQuestion: { type: 'string', enum: ['duration', 'walking'] },
      },
      required: ['status', 'intent'],
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
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        focusedStopId: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['status', 'focusedStopId', 'name'],
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
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        origin: { type: 'object' },
        previousPlanRemoved: { type: 'boolean' },
      },
      required: ['status', 'origin', 'previousPlanRemoved'],
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
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        intent: { type: 'string' },
        planUpdated: { type: 'boolean', const: false },
        existingPlanPreserved: { type: 'boolean' },
      },
      required: ['status', 'intent', 'planUpdated', 'existingPlanPreserved'],
      additionalProperties: false,
    },
  },
  {
    name: 'advance_to_next_stop',
    title: 'Advance to next stop',
    description: 'Marks the current leg as started and focuses the next available stop.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'complete', 'needs_plan', 'needs_repair'] },
        nextStop: { type: ['object', 'null'] },
        unavailableStopIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'nextStop'],
      additionalProperties: false,
    },
    annotations: { untrustedContentHint: true },
  },
  {
    name: 'propose_stop_repair',
    title: 'Propose a stop repair',
    description: 'Finds a real nearby replacement for an unavailable stop while preserving the current origin and constraints. It shows a proposal in Buki and never changes the route until the person confirms.',
    inputSchema: {
      type: 'object',
      properties: {
        stopId: { type: 'string', description: 'Unavailable stop identifier.' },
      },
      required: ['stopId'],
      additionalProperties: false,
    },
    outputSchema: REPAIR_PROPOSAL_OUTPUT_SCHEMA,
    annotations: { untrustedContentHint: true },
  },
  {
    name: 'get_buki_context',
    title: 'Get Buki context',
    description: 'Returns Buki’s current planning state, including the full pending repair proposal when one awaits human confirmation.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', enum: ['buki'] },
        mapSource: { type: 'string' },
        origin: { type: ['string', 'null'] },
        preferences: { type: 'object' },
        nextQuestion: { type: ['string', 'null'] },
        stopCount: { type: 'integer' },
        activeStopId: { type: ['string', 'null'] },
        repair: { type: 'string' },
        pendingRepair: { anyOf: [REPAIR_PROPOSAL_OUTPUT_SCHEMA, { type: 'null' }] },
        manualControlsAvailable: { type: 'boolean' },
      },
      required: ['app', 'mapSource', 'origin', 'stopCount', 'activeStopId', 'repair', 'pendingRepair', 'manualControlsAvailable'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
]

const ACTIONS_BY_TOOL: Record<WebMcpToolName, keyof BukiWebMcpActions> = {
  replan_route: 'replanRoute',
  get_plan_place_snapshot: 'getPlanPlaceSnapshot',
  get_planned_leg: 'getPlannedLeg',
  get_itinerary: 'getItinerary',
  plan_walk: 'planWalk',
  focus_stop: 'focusStop',
  set_origin: 'setOrigin',
  update_intent: 'updateIntent',
  advance_to_next_stop: 'advanceToNextStop',
  propose_stop_repair: 'proposeStopRepair',
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
