import type { PlaceKind } from './types'

export const KIND_LABELS: Record<PlaceKind, string> = {
  food: 'Eat something local',
  culture: 'Culture',
  view: 'Viewpoint',
}

export const KIND_SYMBOLS: Record<PlaceKind, string> = {
  food: '✦',
  culture: '◇',
  view: '△',
}

export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

export function formatSnapshotTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  return `Snapshot · ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}
