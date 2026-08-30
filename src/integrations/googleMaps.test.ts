import { describe, expect, it } from 'vitest'
import { BUKI_MAP_BOUNDS, createBukiMapOptions, MAXIMUM_MAP_ZOOM, MINIMUM_MAP_ZOOM } from './googleMaps'

describe('Buki map interaction', () => {
  it('keeps the global map inside real-world bounds and prevents over-zooming out', () => {
    const options = createBukiMapOptions({ lat: 20, lng: 0 }, 'map-id', 0)

    expect(options).toMatchObject({
      gestureHandling: 'greedy',
      minZoom: MINIMUM_MAP_ZOOM,
      maxZoom: MAXIMUM_MAP_ZOOM,
      zoom: MINIMUM_MAP_ZOOM,
      restriction: {
        latLngBounds: BUKI_MAP_BOUNDS,
        strictBounds: true,
      },
    })
  })

  it('preserves familiar map controls while capping close zoom', () => {
    const options = createBukiMapOptions({ lat: -33.45, lng: -70.66 }, '', 99)

    expect(options).toMatchObject({
      zoom: MAXIMUM_MAP_ZOOM,
      zoomControl: true,
      fullscreenControl: true,
      keyboardShortcuts: true,
      mapId: 'DEMO_MAP_ID',
    })
  })
})
