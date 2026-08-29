import type { InputSchema, ModelContextTool, WebMcpToolAnnotations } from '@mcp-b/webmcp-types'

export type WebMcpToolName =
  | 'search_nearby_places'
  | 'get_place_status'
  | 'compute_walking_route'
  | 'get_itinerary'
  | 'propose_itinerary'
  | 'replace_stop'
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
  proposeItinerary: (input: Record<string, unknown>) => Promise<unknown> | unknown
  replaceStop: (input: Record<string, unknown>) => Promise<unknown> | unknown
  focusStop: (input: Record<string, unknown>) => Promise<unknown> | unknown
  setOrigin: (input: Record<string, unknown>) => Promise<unknown> | unknown
  updateIntent: (input: Record<string, unknown>) => Promise<unknown> | unknown
  advanceToNextStop: () => Promise<unknown> | unknown
  getBukiContext: () => Promise<unknown> | unknown
}

export const BUKI_WEBMCP_TOOLS: readonly WebMcpToolDefinition[] = [
  {
    name: 'search_nearby_places',
    title: 'Buscar lugares cercanos',
    description: 'Busca lugares cercanos al origen actual, filtrados opcionalmente por comida, cultura o paseo al aire libre.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['food', 'culture', 'view'], description: 'Categoría de interés.' },
        radiusMeters: { type: 'integer', minimum: 100, maximum: 50000, description: 'Radio de búsqueda en metros.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_place_status',
    title: 'Consultar estado de un lugar',
    description: 'Devuelve disponibilidad, dirección y hora de consulta de una parada del plan.',
    inputSchema: {
      type: 'object',
      properties: {
        placeId: { type: 'string', description: 'Identificador de la parada.' },
      },
      required: ['placeId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'compute_walking_route',
    title: 'Calcular ruta caminando',
    description: 'Devuelve el tiempo y distancia caminando entre dos lugares del plan actual.',
    inputSchema: {
      type: 'object',
      properties: {
        fromPlaceId: { type: 'string', description: 'Origen del tramo. Usa origin para el punto de partida.' },
        toPlaceId: { type: 'string', description: 'Destino del tramo.' },
      },
      required: ['toPlaceId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_itinerary',
    title: 'Leer itinerario actual',
    description: 'Lee el circuito actual, sus paradas, estados, tiempos y fuente de datos.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'propose_itinerary',
    title: 'Proponer itinerario',
    description: 'Prepara una propuesta de plan basada en una intención sin aplicarla automáticamente.',
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'Lo que la persona quiere hacer.' },
      },
      required: ['intent'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'replace_stop',
    title: 'Reemplazar parada',
    description: 'Propone un reemplazo para una parada cerrada; solo lo aplica si apply es true.',
    inputSchema: {
      type: 'object',
      properties: {
        stopId: { type: 'string', description: 'Identificador de la parada a reemplazar.' },
        apply: { type: 'boolean', description: 'Si es true, hace visible el reemplazo en el plan.' },
      },
      required: ['stopId'],
      additionalProperties: false,
    },
  },
  {
    name: 'focus_stop',
    title: 'Enfocar parada',
    description: 'Mueve la tarjeta de siguiente parada a una parada concreta del circuito.',
    inputSchema: {
      type: 'object',
      properties: {
        stopId: { type: 'string', description: 'Identificador de la parada.' },
      },
      required: ['stopId'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_origin',
    title: 'Cambiar punto de partida',
    description: 'Cambia el origen del plan a uno de los puntos disponibles en Buki.',
    inputSchema: {
      type: 'object',
      properties: {
        locationId: { type: 'string', description: 'Identificador del punto de partida.' },
      },
      required: ['locationId'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_intent',
    title: 'Actualizar intención',
    description: 'Actualiza el texto de intención visible para la persona sin inventar un nuevo plan.',
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'Nueva intención de la persona.' },
      },
      required: ['intent'],
      additionalProperties: false,
    },
  },
  {
    name: 'advance_to_next_stop',
    title: 'Avanzar a siguiente parada',
    description: 'Marca el tramo actual como iniciado y enfoca la siguiente parada disponible.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_buki_context',
    title: 'Leer contexto de Buki',
    description: 'Devuelve el estado resumido de Buki, la disponibilidad WebMCP y el origen de datos del plan.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
]

const ACTIONS_BY_TOOL: Record<WebMcpToolName, keyof BukiWebMcpActions> = {
  search_nearby_places: 'searchNearbyPlaces',
  get_place_status: 'getPlaceStatus',
  compute_walking_route: 'computeWalkingRoute',
  get_itinerary: 'getItinerary',
  propose_itinerary: 'proposeItinerary',
  replace_stop: 'replaceStop',
  focus_stop: 'focusStop',
  set_origin: 'setOrigin',
  update_intent: 'updateIntent',
  advance_to_next_stop: 'advanceToNextStop',
  get_buki_context: 'getBukiContext',
}

function summarizeResult(result: unknown) {
  if (typeof result === 'string') return result.slice(0, 120)
  if (result && typeof result === 'object' && 'status' in result) return String(result.status)
  return 'Resultado entregado al agente'
}

export function createRegisteredTool(
  definition: WebMcpToolDefinition,
  actions: BukiWebMcpActions,
  onCall: (record: Omit<WebMcpCallRecord, 'id' | 'timestamp'>) => void,
): RegisteredBukiTool {
  const actionName = ACTIONS_BY_TOOL[definition.name]

  return {
    ...definition,
    async execute(input) {
      try {
        const result = await actions[actionName](input)
        onCall({ name: definition.name, status: 'success', summary: summarizeResult(result) })
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool execution failed'
        onCall({ name: definition.name, status: 'error', summary: message.slice(0, 120) })
        return { status: 'error', message }
      }
    },
  }
}
