import type { TripStop } from './types'

export function getProgressStops(stops: TripStop[]) {
  const availableStops = stops.filter((stop) => stop.place.availability !== 'closed')
  return availableStops.length ? availableStops : stops
}

export function resolveActiveStop(stops: TripStop[], activeStopId: string | null) {
  const progressStops = getProgressStops(stops)
  return progressStops.find((stop) => stop.id === activeStopId) ?? progressStops[0]
}

export function firstProgressStopId(stops: TripStop[]) {
  return resolveActiveStop(stops, null)?.id ?? null
}

export function activeStopIdAfterReplacement(
  activeStopId: string | null,
  originalStopId: string,
  replacementStopId: string,
  repairedStops: TripStop[],
) {
  const preferredId = activeStopId === originalStopId ? replacementStopId : activeStopId
  return resolveActiveStop(repairedStops, preferredId)?.id ?? null
}

export function activeStopIdAfterUndo(
  activeStopId: string | null,
  originalStopId: string,
  replacementStopId: string,
  previousStops: TripStop[],
) {
  const preferredId = activeStopId === replacementStopId ? originalStopId : activeStopId
  return resolveActiveStop(previousStops, preferredId)?.id ?? null
}

export type AdvanceProgressResult =
  | { status: 'needs_repair'; nextStop: { id: string; name: string } | null; unavailableStopIds: string[] }
  | { status: 'complete'; nextStop: { id: string; name: string } | null }
  | { status: 'ok'; nextStop: { id: string; name: string }; activeStopId: string }

export function advanceProgress(stops: TripStop[], activeStopId: string | null): AdvanceProgressResult {
  const currentStop = resolveActiveStop(stops, activeStopId)
  const allStopsClosed = stops.length > 0 && stops.every((stop) => stop.place.availability === 'closed')
  if (allStopsClosed) {
    return {
      status: 'needs_repair',
      nextStop: currentStop ? { id: currentStop.id, name: currentStop.place.name } : null,
      unavailableStopIds: stops.map((stop) => stop.id),
    }
  }

  const progressStops = getProgressStops(stops)
  const currentIndex = currentStop ? progressStops.findIndex((stop) => stop.id === currentStop.id) : -1
  if (!currentStop || currentIndex >= progressStops.length - 1) {
    return {
      status: 'complete',
      nextStop: currentStop ? { id: currentStop.id, name: currentStop.place.name } : null,
    }
  }

  const nextStop = progressStops[currentIndex + 1]
  return {
    status: 'ok',
    nextStop: { id: nextStop.id, name: nextStop.place.name },
    activeStopId: nextStop.id,
  }
}
