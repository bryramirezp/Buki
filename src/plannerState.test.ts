import { describe, expect, it } from 'vitest'
import {
  activeStopIdAfterReplacement,
  activeStopIdAfterUndo,
  advanceProgress,
  getProgressStops,
  resolveActiveStop,
} from './plannerState'
import type { PlaceAvailability, TripStop } from './types'

function stop(id: string, availability: PlaceAvailability): TripStop {
  return {
    id,
    sequence: Number(id.replace(/\D/g, '')) || 1,
    place: {
      id,
      name: id,
      kind: 'culture',
      summary: '',
      address: '',
      availability,
      availabilityLabel: availability,
      checkedAt: '2026-08-30T00:00:00.000Z',
      coordinates: { lat: 0, lng: 0 },
    },
    walkFromPrevious: { fromId: 'origin', toId: id, minutes: 1, meters: 10 },
  }
}

describe('planner progress state', () => {
  it('keeps progress attached to a stop id when the filtered order changes', () => {
    const stops = [stop('stop-1', 'closed'), stop('stop-2', 'open'), stop('stop-3', 'open')]

    expect(resolveActiveStop(stops, 'stop-3')?.id).toBe('stop-3')
  })

  it('falls back to the actual plan when every stop is closed', () => {
    const stops = [stop('stop-1', 'closed'), stop('stop-2', 'closed')]

    expect(getProgressStops(stops)).toEqual(stops)
    expect(resolveActiveStop(stops, null)?.id).toBe('stop-1')
  })

  it('moves focus to a replacement and restores it on undo', () => {
    const previous = [stop('stop-1', 'open'), stop('stop-2', 'open'), stop('stop-3', 'open')]
    const repaired = [stop('stop-1', 'open'), stop('replacement-2', 'open'), stop('stop-3', 'open')]
    const replacedActiveId = activeStopIdAfterReplacement('stop-2', 'stop-2', 'replacement-2', repaired)

    expect(replacedActiveId).toBe('replacement-2')
    expect(activeStopIdAfterUndo(replacedActiveId, 'stop-2', 'replacement-2', previous)).toBe('stop-2')
    expect(activeStopIdAfterReplacement('stop-3', 'stop-2', 'replacement-2', repaired)).toBe('stop-3')
    expect(activeStopIdAfterUndo('stop-3', 'stop-2', 'replacement-2', previous)).toBe('stop-3')
  })

  it('advances by id and makes an all-closed route explicitly repairable', () => {
    const available = [stop('stop-1', 'open'), stop('stop-2', 'open')]
    const closed = [stop('stop-1', 'closed'), stop('stop-2', 'closed')]

    expect(advanceProgress(available, 'stop-1')).toEqual({
      status: 'ok',
      nextStop: { id: 'stop-2', name: 'stop-2' },
      activeStopId: 'stop-2',
    })
    expect(advanceProgress(closed, null)).toEqual({
      status: 'needs_repair',
      nextStop: { id: 'stop-1', name: 'stop-1' },
      unavailableStopIds: ['stop-1', 'stop-2'],
    })
  })
})
