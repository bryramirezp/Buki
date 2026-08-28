import type { Alternative, ApprovalRequest, ServiceLine } from '../types'

interface ToolContext {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void>
}

interface WebMcpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean }
  execute: (input: any, options?: { signal?: AbortSignal }) => unknown | Promise<unknown>
}

export interface ToolHandlers {
  getDisruption: (input: { serviceId?: string }) => unknown
  getItinerary: (input: { day?: number; status?: string }) => unknown
  listAlternatives: (input: { serviceId: string }) => unknown
  checkItinerary: () => unknown
  proposeRepair: (input: { serviceId: string; alternativeId: string }) => unknown
  undoRepair: () => unknown
  requestApproval: (input: { note?: string }, signal?: AbortSignal) => Promise<unknown>
  commitRepairs: () => unknown
  focusDay: (input: { day: number }) => unknown
}

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object', properties, required, additionalProperties: false,
})

export async function registerBukiTools(
  context: ToolContext,
  handlers: ToolHandlers,
  onCall: (name: string, input: unknown, result: unknown) => void,
  controller = new AbortController(),
) {
  const definitions: WebMcpTool[] = [
    {
      name: 'get_disruption',
      description: 'Read the active itinerary disruption and its downstream impact.',
      inputSchema: objectSchema({ serviceId: { type: 'string', description: 'Optional service id.' } }),
      annotations: { readOnlyHint: true },
      execute: async (input) => run('get_disruption', input, handlers.getDisruption(input), onCall),
    },
    {
      name: 'get_itinerary',
      description: 'Read concise itinerary service lines with optional filters.',
      inputSchema: objectSchema({
        day: { type: 'integer', description: 'Optional day number.' },
        status: { type: 'string', description: 'Optional service status.' },
      }),
      annotations: { readOnlyHint: true },
      execute: async (input) => run('get_itinerary', input, handlers.getItinerary(input), onCall),
    },
    {
      name: 'list_alternatives',
      description: 'List replacement options for one affected service.',
      inputSchema: objectSchema({ serviceId: { type: 'string', description: 'Service id to repair.' } }, ['serviceId']),
      annotations: { readOnlyHint: true },
      execute: async (input) => run('list_alternatives', input, handlers.listAlternatives(input), onCall),
    },
    {
      name: 'check_itinerary',
      description: 'Validate dependency timing and orphaned services.',
      inputSchema: objectSchema({}),
      annotations: { readOnlyHint: true },
      execute: async (input) => run('check_itinerary', input, handlers.checkItinerary(), onCall),
    },
    {
      name: 'propose_repair',
      description: 'Apply one tentative replacement. It never commits money.',
      inputSchema: objectSchema({
        serviceId: { type: 'string', description: 'Affected service to replace.' },
        alternativeId: { type: 'string', description: 'Alternative id.' },
      }, ['serviceId', 'alternativeId']),
      execute: async (input) => run('propose_repair', input, handlers.proposeRepair(input), onCall),
    },
    {
      name: 'undo_repair',
      description: 'Undo the most recent tentative repair.',
      inputSchema: objectSchema({}),
      execute: async (input) => run('undo_repair', input, handlers.undoRepair(), onCall),
    },
    {
      name: 'request_approval',
      description: 'Show a proposed repair to the human and wait for a decision.',
      inputSchema: objectSchema({ note: { type: 'string', description: 'Optional reviewer context.' } }),
      execute: async (input, options) => run('request_approval', input, await handlers.requestApproval(input, options?.signal), onCall),
    },
    {
      name: 'commit_repairs',
      description: 'Commit a repair only after human approval and clean validation.',
      inputSchema: objectSchema({}),
      execute: async (input) => run('commit_repairs', input, handlers.commitRepairs(), onCall),
    },
    {
      name: 'focus_day',
      description: 'Focus the page on a day of the itinerary.',
      inputSchema: objectSchema({ day: { type: 'integer', description: 'Day number.' } }, ['day']),
      execute: async (input) => run('focus_day', input, handlers.focusDay(input), onCall),
    },
  ]

  for (const definition of definitions) {
    await context.registerTool(definition, { signal: controller.signal })
  }
  return controller
}

async function run(name: string, input: unknown, result: unknown, onCall: (name: string, input: unknown, result: unknown) => void) {
  onCall(name, input, result)
  return result
}

export function getModelContext(): ToolContext | null {
  const candidate = (document as Document & { modelContext?: ToolContext }).modelContext
    ?? (navigator as Navigator & { modelContext?: ToolContext }).modelContext
  return candidate ?? null
}

export type { Alternative, ApprovalRequest, ServiceLine }
