import { describe, expect, it } from 'vitest'
import { BUKI_MAP_BOUNDS, createBukiMapOptions, INITIAL_MAP_ZOOM, MAXIMUM_MAP_ZOOM, MINIMUM_MAP_ZOOM } from './googleMaps'

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
      fullscreenControl: false,
      keyboardShortcuts: true,
      mapId: 'DEMO_MAP_ID',
    })
  })

  it('starts one level above the global minimum so zoom out remains useful', () => {
    const options = createBukiMapOptions({ lat: 20, lng: 0 }, 'map-id', INITIAL_MAP_ZOOM)

    expect(options.zoom).toBe(MINIMUM_MAP_ZOOM + 1)
  })
})
