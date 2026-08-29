import { useEffect, useRef, useState, type FormEvent } from 'react'
import { WebMcpInspector } from './components/WebMcpInspector'
import type {
  AppliedGoogleStopRepair,
  GoogleMapProgress,
  GoogleMapsController,
  GoogleStopRepairProposal,
} from './integrations/googleMaps'
import {
  applyGoogleStopRepair,
  buildGoogleTripPlan,
  clearGoogleMapRoute,
  MINIMUM_MAP_ZOOM,
  createGoogleMap,
  describeGoogleMapPoint,
  enableGoogleMapPointSelection,
  moveGoogleMap,
  proposeGoogleStopRepair,
  undoGoogleStopRepair,
  updateGoogleMapMarkers,
} from './integrations/googleMaps'
import type {
  GeoPoint,
  PlaceKind,
  PlannerAnswers,
  PlannerClarificationResponse,
  PlannerQuestion,
  PlannerReadyResponse,
  PlannerResponse,
  TripLocation,
  TripPlace,
  TripPlan,
  TripRequest,
  TripStop,
} from './types'
import { useWebMcp } from './hooks/useWebMcp'
import type { BukiWebMcpActions } from './integrations/webmcp'

type MapState = 'loading' | 'ready' | 'error' | 'unavailable'
type LocationState = 'idle' | 'picking' | 'requesting' | 'resolving' | 'selected' | 'denied' | 'unsupported'
type OriginMethod = 'device' | 'map' | 'agent' | null

const DEFAULT_INTENT = ''
const DEFAULT_MAP_CENTER: GeoPoint = { lat: 20, lng: 0 }
const DEFAULT_MAP_ZOOM = MINIMUM_MAP_ZOOM
const SELECTED_POINT_ZOOM = 15

const KIND_LABELS = {
  food: 'Eat something local',
  culture: 'Culture',
  view: 'Viewpoint',
} as const

const KIND_SYMBOLS = {
  food: '✦',
  culture: '◇',
  view: '△',
} as const

const DURATION_OPTIONS = [
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: 'All afternoon', value: 240 },
] as const

const WALKING_OPTIONS = [
  { label: 'Keep it very short', value: 10 },
  { label: 'A relaxed walk', value: 20 },
  { label: 'I’m happy to walk more', value: 40 },
] as const

const WALK_LIMIT_NOTICE = 'No nearby route fits the walking limit you chose.'
const TIME_LIMIT_NOTICE = 'No nearby route fits the time you chose.'

const apiUrl = import.meta.env.VITE_BUKI_API_URL ?? ''
const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''
const mapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() ?? ''

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

function coordinateDetail(coordinates: GeoPoint) {
  return `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
}

function getGoogleErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'GOOGLE_MAPS_KEY_MISSING') return 'Configure a Google Maps key to build a real route.'
    if (error.message === 'GOOGLE_MAPS_NOT_ENOUGH_PLACES') return 'Google Maps did not find enough nearby places to build the route.'
    if (error.message === 'GOOGLE_MAPS_ROUTE_EXCEEDS_WALK_LIMIT') return WALK_LIMIT_NOTICE
    if (error.message === 'GOOGLE_MAPS_ROUTE_EXCEEDS_TIME_LIMIT') return TIME_LIMIT_NOTICE
    if (error.message.includes('REQUEST_DENIED') || error.message.includes('ApiNotActivated')) {
      return 'Google Maps rejected the request. Check enabled APIs, restrictions, and key billing.'
    }
  }
  return 'We could not query Google Maps right now. Please try again.'
}

function getPlannerErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.startsWith('GOOGLE_MAPS_')) return getGoogleErrorMessage(error)
  if (error instanceof Error && error.message) return error.message
  return 'We could not interpret that request. Please try again.'
}

function isPlannerResponse(value: unknown): value is PlannerResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  const preferences = candidate.preferences
  if (!preferences || typeof preferences !== 'object' || typeof candidate.intent !== 'string') return false
  const parsedPreferences = preferences as Record<string, unknown>
  if (candidate.mode === 'clarification') {
    return (
      (candidate.nextQuestion === 'duration' || candidate.nextQuestion === 'walking') &&
      (parsedPreferences.availableMinutes === undefined || typeof parsedPreferences.availableMinutes === 'number') &&
      (parsedPreferences.maxWalkMinutes === undefined || typeof parsedPreferences.maxWalkMinutes === 'number')
    )
  }
  const request = candidate.request
  if (!request || typeof request !== 'object') return false
  const parsedRequest = request as Record<string, unknown>
  return (
    candidate.mode === 'ready' &&
    typeof candidate.title === 'string' &&
    typeof candidate.explanation === 'string' &&
    typeof parsedPreferences.availableMinutes === 'number' &&
    typeof parsedPreferences.maxWalkMinutes === 'number' &&
    Array.isArray(parsedRequest.interests) &&
    typeof parsedRequest.availableMinutes === 'number' &&
    typeof parsedRequest.maxWalkMinutes === 'number' &&
    (parsedRequest.stopCount === 2 || parsedRequest.stopCount === 3)
  )
}

function pointFromToolInput(input: Record<string, unknown>): GeoPoint | null {
  const latitude = input.latitude
  const longitude = input.longitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { lat: latitude, lng: longitude }
}

function searchRadiusFromToolInput(input: Record<string, unknown>) {
  if (input.radiusMeters === undefined) return undefined
  const radiusMeters = input.radiusMeters
  if (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters) || radiusMeters < 100 || radiusMeters > 50000) {
    throw new Error('VALID_RADIUS_METERS_REQUIRED')
  }
  return Math.round(radiusMeters)
}

function plannerAnswersFromToolInput(input: Record<string, unknown>): PlannerAnswers {
  const answers: PlannerAnswers = {}
  if (input.availableMinutes !== undefined) {
    if (typeof input.availableMinutes !== 'number' || !Number.isFinite(input.availableMinutes) || input.availableMinutes < 30 || input.availableMinutes > 720) {
      throw new Error('VALID_AVAILABLE_MINUTES_REQUIRED')
    }
    answers.availableMinutes = Math.round(input.availableMinutes)
  }
  if (input.maxWalkMinutes !== undefined) {
    if (typeof input.maxWalkMinutes !== 'number' || !Number.isFinite(input.maxWalkMinutes) || input.maxWalkMinutes < 5 || input.maxWalkMinutes > 90) {
      throw new Error('VALID_MAX_WALK_MINUTES_REQUIRED')
    }
    answers.maxWalkMinutes = Math.round(input.maxWalkMinutes)
  }
  return answers
}

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const googleMapRef = useRef<GoogleMapsController | null>(null)
  const mapInitializationRef = useRef<Promise<GoogleMapsController> | null>(null)
  const mapPointSelectionRef = useRef(false)
  const [mapState, setMapState] = useState<MapState>(mapsApiKey ? 'loading' : 'unavailable')
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [originMethod, setOriginMethod] = useState<OriginMethod>(null)
  const [plannerRequest, setPlannerRequest] = useState<TripRequest | null>(null)
  const [plannerAnswers, setPlannerAnswers] = useState<PlannerAnswers>({})
  const [clarification, setClarification] = useState<PlannerClarificationResponse | null>(null)
  const [readyPlanner, setReadyPlanner] = useState<PlannerReadyResponse | null>(null)
  const [customAnswer, setCustomAnswer] = useState('')
  const [isPlanning, setIsPlanning] = useState(false)
  const [intent, setIntent] = useState(DEFAULT_INTENT)
  const [origin, setOrigin] = useState<TripLocation | null>(null)
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [activeStopIndex, setActiveStopIndex] = useState(0)
  const [repairProposal, setRepairProposal] = useState<GoogleStopRepairProposal | null>(null)
  const [appliedRepair, setAppliedRepair] = useState<AppliedGoogleStopRepair | null>(null)
  const [repairingStopId, setRepairingStopId] = useState<string | null>(null)
  const [planningActivityLabel, setPlanningActivityLabel] = useState('')
  const [notice, setNotice] = useState('')
  const [mapError, setMapError] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(false)

  async function ensureGoogleMap(center = DEFAULT_MAP_CENTER, zoom = DEFAULT_MAP_ZOOM) {
    if (!mapsApiKey) throw new Error('GOOGLE_MAPS_KEY_MISSING')
    if (googleMapRef.current) {
      moveGoogleMap(googleMapRef.current, center, zoom)
      return googleMapRef.current
    }
    if (mapInitializationRef.current) return mapInitializationRef.current
    if (!mapContainerRef.current) throw new Error('GOOGLE_MAPS_CONTAINER_MISSING')

    setMapState('loading')
    const initialization = createGoogleMap(mapContainerRef.current, center, mapsApiKey, mapsMapId, zoom)
      .then((controller) => {
        googleMapRef.current = controller
        enableGoogleMapPointSelection(controller, (coordinates) => {
          if (!mapPointSelectionRef.current) return
          void selectOriginFromPoint(coordinates, 'map')
        })
        setMapState('ready')
        return controller
      })
      .catch((error) => {
        mapInitializationRef.current = null
        setMapState('error')
        setMapError(getGoogleErrorMessage(error))
        throw error
      })

    mapInitializationRef.current = initialization
    return initialization
  }

  useEffect(() => {
    if (!mapsApiKey) return
    void ensureGoogleMap().catch(() => undefined)
    // The map is initialized once. Later origin changes are handled by selectOriginFromPoint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsApiKey])

  useEffect(() => {
    if (!googleMapRef.current || !origin) return
    moveGoogleMap(googleMapRef.current, origin.coordinates, SELECTED_POINT_ZOOM)
    updateGoogleMapMarkers(googleMapRef.current, origin, plan?.stops ?? [])
  }, [origin, plan])

  const stops = plan?.stops ?? []
  const availableStops = stops.filter((stop) => stop.place.availability !== 'closed')
  const currentStop = availableStops.length
    ? availableStops[Math.min(activeStopIndex, availableStops.length - 1)]
    : undefined
  const totalWalkingMinutes = plan?.totalWalkingMinutes ?? 0
  const totalEstimatedMinutes = plan?.totalEstimatedMinutes ?? 0
  const mapLabel = mapState === 'ready'
    ? plan ? 'Google Maps · real route' : 'Google Maps ready'
    : mapState === 'loading'
      ? 'Loading Google Maps'
      : mapState === 'error'
        ? 'Maps unavailable'
        : 'Maps key required'
  const locationStepMessage = locationState === 'requesting'
    ? 'Waiting for location permission…'
    : locationState === 'resolving'
      ? 'Finding that point…'
      : locationState === 'picking'
        ? 'Tap anywhere on the map to set your starting point.'
        : origin
          ? `Starting from ${origin.name}. You can change this anytime.`
          : 'You can change this anytime.'

  async function selectOriginFromPoint(coordinates: GeoPoint, source: 'device' | 'map' | 'agent'): Promise<TripLocation> {
    mapPointSelectionRef.current = false
    setLocationState('resolving')
    setNotice('Looking up the selected location…')

    const controller = await ensureGoogleMap(coordinates, SELECTED_POINT_ZOOM)
    let name = source === 'device' ? 'Current location' : 'Selected point'
    let detail = coordinateDetail(coordinates)
    try {
      const address = await describeGoogleMapPoint(coordinates)
      name = address.name
      detail = address.detail
    } catch {
      // Coordinates remain a truthful fallback if reverse geocoding is unavailable.
    }

    const nextOrigin: TripLocation = {
      id: `point-${coordinates.lat.toFixed(6)}-${coordinates.lng.toFixed(6)}`,
      name,
      detail,
      coordinates,
    }
    setOrigin(nextOrigin)
    setOriginMethod(source)
    setPlan(null)
    setActiveStopIndex(0)
    setRepairProposal(null)
    setAppliedRepair(null)
    setRepairingStopId(null)
    clearGoogleMapRoute(controller)
    updateGoogleMapMarkers(controller, nextOrigin, [])
    setLocationState('selected')
    setNotice(source === 'device'
      ? 'Your current location is ready. Describe what you want to do to build a route.'
      : 'Starting point selected. Describe what you want to do to build a route.')
    return nextOrigin
  }

  async function startMapPointSelection() {
    if (!mapsApiKey) {
      setNotice('Configure a Google Maps key before choosing a point on the map.')
      return
    }
    mapPointSelectionRef.current = true
    setOriginMethod('map')
    setLocationState('picking')
    setNotice('Tap a point on the map to use it as your starting point.')
    try {
      await ensureGoogleMap(origin?.coordinates ?? DEFAULT_MAP_CENTER, origin ? SELECTED_POINT_ZOOM : DEFAULT_MAP_ZOOM)
    } catch (error) {
      mapPointSelectionRef.current = false
      setLocationState('idle')
      setNotice(getGoogleErrorMessage(error))
    }
  }

  function requestDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationState('unsupported')
      setNotice('This browser does not support location access. Choose a point on the map instead.')
      return
    }

    mapPointSelectionRef.current = false
    setOriginMethod('device')
    setLocationState('requesting')
    setNotice('Waiting for permission to access your location…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void selectOriginFromPoint({ lat: coords.latitude, lng: coords.longitude }, 'device').catch((error) => {
          setLocationState('idle')
          setNotice(getGoogleErrorMessage(error))
        })
      },
      () => {
        setLocationState('denied')
        setNotice('Location permission was not granted. Choose a point on the map instead.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  function beginPlanningActivity(label: string) {
    setPlanningActivityLabel(label)
  }

  function advancePlanningActivity(label: GoogleMapProgress) {
    setPlanningActivityLabel(label)
  }

  function finishPlanningActivity() {
    setPlanningActivityLabel('')
  }

  async function fetchRealPlan(
    request = plannerRequest ?? undefined,
    title = plan?.title ?? 'A walk near your starting point',
  ) {
    if (!origin) throw new Error('GOOGLE_MAPS_ORIGIN_MISSING')
    const controller = await ensureGoogleMap(origin.coordinates, SELECTED_POINT_ZOOM)
    return buildGoogleTripPlan(controller, origin, title, origin.detail, request, advancePlanningActivity)
  }

  async function requestLlmPlan(nextIntent: string, answers: PlannerAnswers): Promise<PlannerResponse> {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: nextIntent, answers }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && typeof payload.error === 'string'
        ? payload.error
        : 'The planning function is unavailable.'
      throw new Error(message)
    }
    if (!isPlannerResponse(payload)) throw new Error('The planning function returned an invalid response.')
    return payload
  }

  async function submitIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      if (readyPlanner) {
        await createRealPlan(readyPlanner)
      } else if (clarification) {
        if (!customAnswer.trim()) {
          setNotice('Choose an option or write your own answer to continue.')
          return
        }
        await answerClarification(clarification.nextQuestion, customAnswer.trim())
      } else {
        await preparePlanFromIntent(intent.trim(), {})
      }
    } catch {
      // The shared planner already reports a visible, actionable error message.
    }
  }

  function clearDraftRoute() {
    if (googleMapRef.current) clearGoogleMapRoute(googleMapRef.current)
    setPlan(null)
    setActiveStopIndex(0)
    setRepairProposal(null)
    setAppliedRepair(null)
    setRepairingStopId(null)
  }

  function adjustRouteConstraint(question: PlannerQuestion) {
    const nextAnswers: PlannerAnswers = { ...plannerAnswers }
    if (question === 'walking') {
      delete nextAnswers.maxWalkMinutes
      delete nextAnswers.walking
    } else {
      delete nextAnswers.availableMinutes
      delete nextAnswers.duration
    }

    clearDraftRoute()
    setPlannerAnswers(nextAnswers)
    setClarification({
      mode: 'clarification',
      intent,
      preferences: nextAnswers,
      nextQuestion: question,
    })
    setReadyPlanner(null)
    setPlannerRequest(null)
    setCustomAnswer('')
    setNotice('')
  }

  async function preparePlanFromIntent(nextIntent: string, answers: PlannerAnswers): Promise<PlannerResponse> {
    if (!nextIntent) {
      setNotice('Tell Buki what you would like to do.')
      throw new Error('INTENT_REQUIRED')
    }
    if (!origin) {
      setNotice('Choose your current location or a point on the map before shaping a route.')
      throw new Error('ORIGIN_REQUIRED')
    }

    setIsPlanning(true)
    setNotice('Buki is shaping your plan…')
    beginPlanningActivity('Thinking about your plan…')
    clearDraftRoute()
    try {
      const planner = await requestLlmPlan(nextIntent, answers)
      setIntent(planner.intent)
      setPlannerAnswers({ ...answers, ...planner.preferences })
      if (planner.mode === 'clarification') {
        setClarification(planner)
        setReadyPlanner(null)
        setPlannerRequest(null)
        setNotice(planner.nextQuestion === 'duration'
          ? 'One detail to shape your plan: how much time do you have?'
          : 'One more thing for a comfortable route: how much walking feels right today?')
        return planner
      }

      setClarification(null)
      setReadyPlanner(planner)
      setPlannerRequest(planner.request)
      setNotice('Your plan is shaped. Create it when you are ready to find real places and routes.')
      return planner
    } catch (error) {
      setNotice(getPlannerErrorMessage(error))
      throw error
    } finally {
      setIsPlanning(false)
      finishPlanningActivity()
    }
  }

  async function answerClarification(question: PlannerQuestion, answer: number | string) {
    const nextAnswers: PlannerAnswers = { ...plannerAnswers }
    if (question === 'duration') {
      delete nextAnswers.duration
      if (typeof answer === 'number') {
        nextAnswers.availableMinutes = answer
      } else {
        delete nextAnswers.availableMinutes
        nextAnswers.duration = answer
      }
    } else {
      delete nextAnswers.walking
      if (typeof answer === 'number') {
        nextAnswers.maxWalkMinutes = answer
      } else {
        delete nextAnswers.maxWalkMinutes
        nextAnswers.walking = answer
      }
    }
    setCustomAnswer('')
    await preparePlanFromIntent(intent.trim(), nextAnswers)
  }

  async function createRealPlan(planner: PlannerReadyResponse) {
    if (!origin) {
      setNotice('Choose your current location or a point on the map before creating a route.')
      throw new Error('ORIGIN_REQUIRED')
    }
    if (!mapsApiKey) {
      setNotice('Configure a Google Maps key before creating a real route.')
      throw new Error('GOOGLE_MAPS_KEY_MISSING')
    }

    setIsPlanning(true)
    setNotice('Finding real places and calculating the walking route…')
    beginPlanningActivity('Looking for real places near your starting point')
    clearDraftRoute()
    try {
      const realPlan = await fetchRealPlan(planner.request, planner.title)
      setPlan(realPlan)
      setActiveStopIndex(0)
      setNotice(planner.explanation || `Real plan ready with ${realPlan.stops.length} nearby places.`)
      return realPlan
    } catch (error) {
      setNotice(getPlannerErrorMessage(error))
      throw error
    } finally {
      setIsPlanning(false)
      finishPlanningActivity()
    }
  }

  function repairErrorMessage(error: unknown) {
    if (error instanceof Error && error.message === 'GOOGLE_MAPS_NO_REPLACEMENT') {
      return 'Buki could not verify a compatible replacement nearby. Your current route is unchanged.'
    }
    return getGoogleErrorMessage(error)
  }

  async function requestStopRepair(stopId: string) {
    if (!plan || !plannerRequest) {
      setNotice('Buki needs the current route constraints before it can repair a stop.')
      return null
    }

    setRepairProposal(null)
    setNotice('')
    setRepairingStopId(stopId)
    beginPlanningActivity('Finding a real replacement')
    try {
      const proposal = await proposeGoogleStopRepair(plan, stopId, plannerRequest, advancePlanningActivity)
      setRepairProposal(proposal)
      return proposal
    } catch (error) {
      setNotice(repairErrorMessage(error))
      throw error
    } finally {
      setRepairingStopId(null)
      finishPlanningActivity()
    }
  }

  function acceptStopRepair() {
    if (!plan || !repairProposal || !googleMapRef.current) return
    const applied = applyGoogleStopRepair(googleMapRef.current, plan, repairProposal)
    setPlan(repairProposal.repairedPlan)
    setActiveStopIndex(Math.min(activeStopIndex, repairProposal.repairedPlan.stops.length - 1))
    setAppliedRepair(applied)
    setRepairProposal(null)
    setNotice('')
  }

  function discardStopRepair() {
    setRepairProposal(null)
    setNotice('')
  }

  function undoStopRepair() {
    if (!appliedRepair || !googleMapRef.current) return
    undoGoogleStopRepair(googleMapRef.current, appliedRepair)
    setPlan(appliedRepair.previousPlan)
    setActiveStopIndex(0)
    setAppliedRepair(null)
    setNotice('')
  }

  function moveToNextStop() {
    if (!availableStops.length) {
      setNotice('Create a walk before starting a leg.')
      return { status: 'needs_plan' as const, nextStop: null }
    }
    if (activeStopIndex >= availableStops.length - 1) {
      setNotice('You reached the end of the route. You can return to any stop in the plan.')
      return {
        status: 'complete' as const,
        nextStop: availableStops[activeStopIndex] ? {
          id: availableStops[activeStopIndex].id,
          name: availableStops[activeStopIndex].place.name,
        } : null,
      }
    }
    const nextIndex = activeStopIndex + 1
    const nextStop = availableStops[nextIndex]
    setActiveStopIndex(nextIndex)
    setNotice(`Next: ${nextStop.place.name}.`)
    return { status: 'ok' as const, nextStop: { id: nextStop.id, name: nextStop.place.name } }
  }

  function serializePlanData(currentPlan: TripPlan) {
    return {
      status: 'ok',
      title: currentPlan.title,
      city: currentPlan.city,
      source: currentPlan.source,
      checkedAt: currentPlan.checkedAt,
      origin: { id: currentPlan.origin.id, name: currentPlan.origin.name, detail: currentPlan.origin.detail },
      totalWalkingMinutes: currentPlan.totalWalkingMinutes,
      totalEstimatedMinutes: currentPlan.totalEstimatedMinutes,
      stops: currentPlan.stops.map((stop) => ({
        id: stop.place.id,
        sequence: stop.sequence,
        name: stop.place.name,
        kind: stop.place.kind,
        address: stop.place.address,
        availability: stop.place.availability,
        availabilityLabel: stop.place.availabilityLabel,
        checkedAt: stop.place.checkedAt,
        walkFromPrevious: stop.walkFromPrevious,
      })),
    }
  }

  function serializeStopRepairProposal(proposal: GoogleStopRepairProposal) {
    return {
      status: 'proposal_ready',
      originalStop: {
        id: proposal.originalStop.id,
        name: proposal.originalStop.place.name,
        availability: proposal.originalStop.place.availability,
      },
      replacementStop: {
        id: proposal.replacementStop.id,
        name: proposal.replacementStop.place.name,
        availability: proposal.replacementStop.place.availability,
        availabilityLabel: proposal.replacementStop.place.availabilityLabel,
      },
      affectedLegs: {
        before: proposal.affectedLegs.before,
        after: proposal.affectedLegs.after,
      },
      totalWalkingMinutes: proposal.repairedPlan.totalWalkingMinutes,
      totalEstimatedMinutes: proposal.repairedPlan.totalEstimatedMinutes,
      warnings: proposal.repairedPlan.routeWarnings ?? [],
      selectionReason: proposal.replacementStop.place.availability === 'unknown'
        ? 'Same category and route limits, but availability is not confirmed.'
        : 'Same category, available now, and within the current route limits.',
      requiresUserConfirmation: true,
    }
  }

  function serializePlan() {
    if (plan) return serializePlanData(plan)
    if (clarification) {
      return {
        status: 'needs_clarification',
        intent: clarification.intent,
        preferences: clarification.preferences,
        nextQuestion: clarification.nextQuestion,
        stops: [],
      }
    }
    return {
      status: readyPlanner ? 'ready_to_create' : origin ? 'ready_to_plan' : 'needs_origin',
      origin: origin ? { id: origin.id, name: origin.name, detail: origin.detail } : null,
      stops: [],
    }
  }

  function findToolStop(input: Record<string, unknown>) {
    const stopId = typeof input.stopId === 'string' ? input.stopId : ''
    return stops.find((stop) => stop.id === stopId || stop.place.id === stopId)
  }

  const webMcpActions: BukiWebMcpActions = {
    async searchNearbyPlaces(input) {
      if (!origin) throw new Error('ORIGIN_REQUIRED')
      if (!mapsApiKey) throw new Error('GOOGLE_MAPS_KEY_MISSING')
      if (!plannerRequest) {
        return {
          status: 'needs_clarification',
          message: 'Use plan_walk with the person’s intent and preferences before searching for a route.',
        }
      }
      const requestedKind = input.kind === undefined
        ? undefined
        : typeof input.kind === 'string' && ['food', 'culture', 'view'].includes(input.kind)
          ? input.kind as PlaceKind
          : (() => { throw new Error('VALID_PLACE_KIND_REQUIRED') })()
      const radiusMeters = searchRadiusFromToolInput(input)
      const request: TripRequest = {
        ...plannerRequest,
        ...(requestedKind ? { interests: [requestedKind] } : {}),
        ...(radiusMeters ? { searchRadiusMeters: radiusMeters } : {}),
      }
      setNotice('An agent is building a new real nearby route…')
      beginPlanningActivity('Looking for real places near your starting point')
      if (googleMapRef.current) clearGoogleMapRoute(googleMapRef.current)
      setPlan(null)
      try {
        const realPlan = await fetchRealPlan(request)
        setPlan(realPlan)
        setActiveStopIndex(0)
        return { status: 'ok', source: 'google-maps', itinerary: serializePlanData(realPlan) }
      } catch (error) {
        const message = getGoogleErrorMessage(error)
        setNotice(message)
        throw new Error(message)
      } finally {
        finishPlanningActivity()
      }
    },
    getPlaceStatus(input) {
      const stop = findToolStop({ stopId: input.placeId })
      if (!stop) throw new Error('PLACE_NOT_FOUND')
      return {
        status: 'ok',
        placeId: stop.place.id,
        name: stop.place.name,
        availability: stop.place.availability,
        availabilityLabel: stop.place.availabilityLabel,
        checkedAt: stop.place.checkedAt,
      }
    },
    computeWalkingRoute(input) {
      const stop = findToolStop({ stopId: input.toPlaceId })
      if (!stop) throw new Error('DESTINATION_NOT_FOUND')
      return { status: 'ok', route: stop.walkFromPrevious, source: 'google-maps' }
    },
    getItinerary: serializePlan,
    async planWalk(input) {
      const requestedIntent = typeof input.intent === 'string' ? input.intent.trim() : ''
      const planner = await preparePlanFromIntent(requestedIntent, plannerAnswersFromToolInput(input))
      if (planner.mode === 'clarification') {
        return {
          status: 'needs_clarification',
          intent: planner.intent,
          preferences: planner.preferences,
          nextQuestion: planner.nextQuestion,
        }
      }
      const realPlan = await createRealPlan(planner)
      return {
        status: 'ok',
        intent: planner.intent,
        explanation: planner.explanation,
        itinerary: serializePlanData(realPlan),
      }
    },
    focusStop(input) {
      const stop = findToolStop(input)
      if (!stop) throw new Error('STOP_NOT_FOUND')
      const nextIndex = availableStops.findIndex((item) => item.id === stop.id)
      if (nextIndex < 0) throw new Error('STOP_NOT_AVAILABLE')
      setActiveStopIndex(nextIndex)
      setNotice(`Next stop focused: ${stop.place.name}.`)
      return { status: 'ok', focusedStopId: stop.id, name: stop.place.name }
    },
    async setOrigin(input) {
      const coordinates = pointFromToolInput(input)
      if (!coordinates) throw new Error('VALID_LATITUDE_AND_LONGITUDE_REQUIRED')
      const selectedOrigin = await selectOriginFromPoint(coordinates, 'agent')
      return { status: 'ok', origin: { id: selectedOrigin.id, name: selectedOrigin.name, detail: selectedOrigin.detail } }
    },
    updateIntent(input) {
      const nextIntent = typeof input.intent === 'string' ? input.intent.trim() : ''
      if (!nextIntent) throw new Error('INTENT_REQUIRED')
      setIntent(nextIntent)
      setPlannerAnswers({})
      setClarification(null)
      setReadyPlanner(null)
      setPlannerRequest(null)
      setRepairProposal(null)
      setAppliedRepair(null)
      setNotice('Intent updated by an agent. It has not built a route yet.')
      return { status: 'ok', intent: nextIntent, planUpdated: false }
    },
    advanceToNextStop() {
      return moveToNextStop()
    },
    async proposeStopRepair(input) {
      const stop = findToolStop(input)
      if (!stop) throw new Error('STOP_NOT_FOUND')
      const proposal = await requestStopRepair(stop.id)
      if (!proposal) throw new Error('REPAIR_CONSTRAINTS_UNAVAILABLE')
      return serializeStopRepairProposal(proposal)
    },
    getBukiContext() {
      return {
        app: 'buki',
        webmcp: Boolean(document.modelContext),
        mapSource: plan?.source ?? 'pending',
        origin: origin?.name ?? null,
        preferences: readyPlanner?.preferences ?? clarification?.preferences ?? plannerAnswers,
        nextQuestion: clarification?.nextQuestion ?? null,
        stopCount: stops.length,
        repair: repairProposal ? 'awaiting_user_confirmation' : appliedRepair ? 'applied_can_undo' : 'none',
        manualControlsAvailable: true,
      }
    },
  }

  const webmcp = useWebMcp(webMcpActions)

  const plannerSubmitLabel = isPlanning
    ? planningActivityLabel || 'Buki is thinking…'
    : plan ? 'Walk created'
      : readyPlanner ? 'Create my walk'
          : clarification ? 'Continue with this answer'
          : 'Continue when ready'

  const routeConstraint = notice === WALK_LIMIT_NOTICE
    ? 'walking'
    : notice === TIME_LIMIT_NOTICE
      ? 'duration'
      : null

  function updateIntentDraft(nextIntent: string) {
    setIntent(nextIntent)
    if (clarification || readyPlanner || Object.keys(plannerAnswers).length) {
      setPlannerAnswers({})
      setClarification(null)
      setReadyPlanner(null)
      setPlannerRequest(null)
      setCustomAnswer('')
      clearDraftRoute()
      setNotice('Your request changed. Continue when you are ready and Buki will shape it again.')
    }
  }

  return (
    <main className={`app-shell ${mapState === 'ready' ? 'has-real-map' : ''}`}>
      <section className={`map-stage ${mapState === 'ready' ? 'is-google-map' : ''}`} aria-label="Google Maps">
        <div ref={mapContainerRef} className={`google-map-canvas ${mapState === 'ready' ? 'is-visible' : 'is-hidden'}`} aria-hidden={mapState !== 'ready'} />
        {mapState !== 'ready' && (
          <div className="map-unavailable">
            <strong>{mapState === 'loading' ? 'Loading Google Maps…' : 'Google Maps is unavailable'}</strong>
            <span>{mapError || 'A valid Maps key is required to select a real starting point.'}</span>
          </div>
        )}

        <div className="map-header">
          <div className="brand-lockup">
            <span className="brand-mark">b</span>
            <span>buki</span>
          </div>
          <div className="map-header-actions">
            <button className="webmcp-connection voyage-connection" data-testid="open-webmcp-inspector" type="button" onClick={() => setInspectorOpen(true)}>
              <span className={`webmcp-status-dot voyage-status-dot is-${webmcp.status}`} />
              <span>WebMCP</span>
              <span className="webmcp-tool-count voyage-tool-count">{webmcp.definitions.length} tools</span>
            </button>
            <span className="map-mode">{mapLabel}</span>
          </div>
        </div>

        <div className="map-location-label">
          <span className="pulse-dot" />
          {origin ? origin.name : 'Choose a starting point'}
          <small>{origin ? origin.detail : 'Use your location or tap a pin on the map.'}</small>
        </div>

        <div className="map-footer">
          <div>
            <strong>{plan ? `${stops.length} stops` : 'No route yet'}</strong>
            {plan && <><span>·</span><strong>{totalWalkingMinutes} min walking</strong><span>·</span><strong>{totalEstimatedMinutes} min total</strong></>}
          </div>
          {plan && <span>{`${plan.checkedAt}${plan.routeWarnings?.length ? ' · Review warnings' : ''}`}</span>}
        </div>
      </section>

      <section className="plan-sheet" aria-labelledby="plan-title">
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="plan-content">
          <header className="plan-header">
            <div>
              <h1 id="plan-title">{plan?.title ?? 'Make today count.'}</h1>
              <p className="plan-location">{plan ? `${plan.city} · ${totalWalkingMinutes} min walking · ${totalEstimatedMinutes} min total` : 'A real, walkable itinerary for the mood you’re in—ready in three simple steps.'}</p>
            </div>
          </header>

          <form className="planner-steps" onSubmit={submitIntent}>
            <section className="planner-step origin-step" aria-labelledby="location-title">
              <div className="planner-step-heading">
                <span className="planner-step-number" aria-hidden="true">1</span>
                <h2 id="location-title">Choose a starting point</h2>
              </div>
              <div className="origin-options">
                <button
                  className={`origin-option ${originMethod === 'device' ? 'is-selected' : ''}`}
                  type="button"
                  onClick={requestDeviceLocation}
                  disabled={locationState === 'requesting' || locationState === 'resolving'}
                  aria-pressed={originMethod === 'device'}
                >
                  <span className="origin-option-icon" aria-hidden="true">➤</span>
                  <span>{locationState === 'requesting' ? 'Waiting for permission…' : 'Use my location'}</span>
                </button>
                <button
                  className={`origin-option ${originMethod === 'map' ? 'is-selected' : ''}`}
                  type="button"
                  onClick={() => void startMapPointSelection()}
                  disabled={mapState !== 'ready' || locationState === 'resolving'}
                  aria-pressed={originMethod === 'map'}
                >
                  <span className="origin-option-icon" aria-hidden="true">⌖</span>
                  <span>{locationState === 'picking' ? 'Tap the map' : 'Pick a point on the map'}</span>
                </button>
              </div>
              <p className="planner-step-hint" aria-live="polite">{locationStepMessage}</p>
            </section>

            <section className="planner-step intent-step" aria-labelledby="intent-title">
              <div className="planner-step-heading">
                <span className="planner-step-number" aria-hidden="true">2</span>
                <h2 id="intent-title">What would you enjoy?</h2>
              </div>
              {clarification || readyPlanner ? (
                <div className="captured-intent">
                  <span aria-hidden="true">●</span>
                  <p>{intent}</p>
                  <button type="button" onClick={() => updateIntentDraft(intent)} aria-label="Edit your request">Edit</button>
                </div>
              ) : (
                <label className="intent-input" htmlFor="intent">
                  <textarea id="intent" value={intent} onChange={(event) => updateIntentDraft(event.target.value)} rows={2} aria-label="What would you enjoy?" />
                </label>
              )}

              {(plannerAnswers.availableMinutes || plannerAnswers.maxWalkMinutes) && (
                <div className="preference-summary" aria-label="Your plan preferences">
                  {plannerAnswers.availableMinutes && <span>◷ {plannerAnswers.availableMinutes >= 60 ? `${plannerAnswers.availableMinutes / 60} ${plannerAnswers.availableMinutes === 60 ? 'hour' : 'hours'}` : `${plannerAnswers.availableMinutes} minutes`}</span>}
                  {plannerAnswers.maxWalkMinutes && <span>♧ {plannerAnswers.maxWalkMinutes} min max per walk</span>}
                </div>
              )}

              {clarification && (
                <div className="clarification-card" aria-live="polite">
                  <p className="clarification-kicker">{clarification.nextQuestion === 'duration' ? 'One detail to shape your plan' : 'One more thing for a comfortable route'}</p>
                  <h3>{clarification.nextQuestion === 'duration' ? 'How much time would you like to spend?' : 'How much walking feels comfortable today?'}</h3>
                  <div className="clarification-options">
                    {(clarification.nextQuestion === 'duration' ? DURATION_OPTIONS : WALKING_OPTIONS).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="clarification-option"
                        onClick={() => void answerClarification(clarification.nextQuestion, option.value)}
                        disabled={isPlanning}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <label className="custom-answer" htmlFor="custom-answer">
                    <span>{clarification.nextQuestion === 'duration' ? 'Or write your own answer' : 'Or tell Buki your limit'}</span>
                    <input
                      id="custom-answer"
                      value={customAnswer}
                      onChange={(event) => setCustomAnswer(event.target.value)}
                      placeholder={clarification.nextQuestion === 'duration' ? 'For example, 90 minutes' : 'For example, no more than 15 minutes per walk'}
                      aria-label={clarification.nextQuestion === 'duration' ? 'Your available time' : 'Your walking limit'}
                    />
                  </label>
                </div>
              )}

              {readyPlanner && (
                <p className="planner-ready-message"><span aria-hidden="true">✧</span> Your day is shaped around you. Create it when you are ready.</p>
              )}
            </section>

            <button className={`primary-button planner-submit ${isPlanning ? 'is-thinking' : ''}`} type="submit" disabled={isPlanning || Boolean(plan)}>
              <span className="planner-submit-number" aria-hidden="true">3</span>
              <span>{plannerSubmitLabel}</span>
              {isPlanning ? (
                <span className="planner-loading-dots" aria-label="Working"><i /><i /><i /></span>
              ) : (
                <span className="planner-submit-icon" aria-hidden="true">↗</span>
              )}
            </button>
          </form>

          {routeConstraint && !isPlanning ? (
            <section className="constraint-notice" aria-live="assertive" aria-labelledby="constraint-notice-title">
              <p className="section-kicker">Plan adjustment</p>
              <h2 id="constraint-notice-title">
                {routeConstraint === 'walking' ? 'This route needs a little more walking room.' : 'This route needs a little more time.'}
              </h2>
              <p>
                {routeConstraint === 'walking'
                  ? `The nearby places do not fit within ${plannerAnswers.maxWalkMinutes ?? 'your'} minutes per walk. Choose a new limit and Buki will try again.`
                  : `The nearby places do not fit within ${plannerAnswers.availableMinutes ?? 'your'} available minutes. Choose more time and Buki will try again.`}
              </p>
              <button className="constraint-action" type="button" onClick={() => adjustRouteConstraint(routeConstraint)}>
                <span>{routeConstraint === 'walking' ? 'Adjust walking limit' : 'Adjust available time'}</span>
                <span aria-hidden="true">→</span>
              </button>
            </section>
          ) : (
            <>
              {!plan && !isPlanning && !notice && <p className="planner-assurance"><span aria-hidden="true">⌖✧</span> We'll find real places and walking routes.</p>}
              {notice && !isPlanning && <p className="notice" aria-live="polite">{notice}</p>}
            </>
          )}
          {locationState === 'denied' && <p className="state-hint">Location permission was denied. Pick a point on the map instead.</p>}
          {locationState === 'unsupported' && <p className="state-hint">This browser does not expose location access. Pick a point on the map instead.</p>}

          {plan && currentStop && (
            <section className="next-stop-card" aria-labelledby="next-stop-title">
              <div className="next-stop-topline">
                <p className="section-kicker">Next stop</p>
                <span>{currentStop.sequence.toString().padStart(2, '0')} / {stops.length.toString().padStart(2, '0')}</span>
              </div>
              <h2 id="next-stop-title">{currentStop.place.name}</h2>
              <p>{currentStop.place.summary}</p>
              <div className="next-stop-meta">
                <span>{currentStop.walkFromPrevious.minutes} min from here</span>
                <span>{formatDistance(currentStop.walkFromPrevious.meters)}</span>
              </div>
              <button className="dark-button" type="button" onClick={moveToNextStop}>
                {activeStopIndex >= availableStops.length - 1 ? 'Mark route complete' : 'Start this leg'}
                <span aria-hidden="true">→</span>
              </button>
            </section>
          )}

          {repairProposal && (
            <section className="repair-proposal" aria-live="polite" aria-labelledby="repair-proposal-title">
              <p className="section-kicker">Route repair</p>
              <h2 id="repair-proposal-title">Replace this stop?</h2>
              <p className="repair-intro">Buki found a real nearby alternative of the same kind. Your route will only change after you confirm.</p>
              <div className="repair-comparison">
                <div>
                  <span>Unavailable</span>
                  <strong>{repairProposal.originalStop.place.name}</strong>
                  <small>{repairProposal.affectedLegs.before.reduce((total, leg) => total + leg.minutes, 0)} min across affected legs</small>
                </div>
                <span className="repair-arrow" aria-hidden="true">→</span>
                <div className="is-proposed">
                  <span>Replacement</span>
                  <strong>{repairProposal.replacementStop.place.name}</strong>
                  <small>{repairProposal.affectedLegs.after.reduce((total, leg) => total + leg.minutes, 0)} min across affected legs</small>
                </div>
              </div>
              <p className="repair-total">New route: {repairProposal.repairedPlan.totalWalkingMinutes} min walking · {repairProposal.repairedPlan.totalEstimatedMinutes} min total</p>
              <p className="repair-selection-reason">
                {repairProposal.replacementStop.place.availability === 'unknown'
                  ? 'Same category and route limits, but availability is not confirmed.'
                  : `Same category · ${repairProposal.replacementStop.place.availabilityLabel} · fits your current route limits.`}
              </p>
              {repairProposal.replacementStop.place.availability === 'unknown' && <p className="repair-warning">Availability is not confirmed. Check before you go.</p>}
              <div className="repair-actions">
                <button className="repair-accept" type="button" onClick={acceptStopRepair}>Replace stop <span aria-hidden="true">→</span></button>
                <button className="repair-dismiss" type="button" onClick={discardStopRepair}>Keep current route</button>
              </div>
            </section>
          )}

          {appliedRepair && (
            <section className="repair-applied" aria-live="polite">
              <div>
                <strong>{appliedRepair.proposal.replacementStop.place.name} replaced {appliedRepair.proposal.originalStop.place.name}.</strong>
                <span>The route and markers are updated with real Maps data.</span>
              </div>
              <button type="button" onClick={undoStopRepair}>Undo</button>
            </section>
          )}

          {plan ? (
            <section className="stops-section" aria-labelledby="stops-title">
              <div className="section-heading stops-heading">
                <div>
                  <p className="section-kicker">Suggested route</p>
                  <h2 id="stops-title">Places near you</h2>
                </div>
                <span className="walking-limit">Max. {plannerRequest?.maxWalkMinutes ?? '—'} min / leg</span>
              </div>
              <div className="stops-list">
                {stops.map((stop, index) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    isCurrent={currentStop?.id === stop.id}
                    showWalking={index > 0 || Boolean(stop.walkFromPrevious)}
                    onRequestRepair={() => void requestStopRepair(stop.id).catch(() => undefined)}
                    isRepairing={repairingStopId === stop.id}
                    repairDisabled={Boolean(repairProposal || appliedRepair || repairingStopId)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {plan && (
            <footer className="data-footer">
              <span className="data-dot" />
              <span>{plan.checkedAt} · Data may change.</span>
            </footer>
          )}
        </div>
      </section>
      <WebMcpInspector
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        status={webmcp.status}
        definitions={webmcp.definitions}
        registeredTools={webmcp.registeredTools}
        registeredCount={webmcp.registeredCount}
        calls={webmcp.calls}
      />
    </main>
  )
}

interface StopCardProps {
  stop: TripStop
  isCurrent: boolean
  showWalking: boolean
  onRequestRepair: () => void
  isRepairing: boolean
  repairDisabled: boolean
}

function StopCard({ stop, isCurrent, showWalking, onRequestRepair, isRepairing, repairDisabled }: StopCardProps) {
  const place: TripPlace = stop.place
  const isClosed = place.availability === 'closed'

  return (
    <div className="stop-group">
      {showWalking && (
        <div className="walking-connector">
          <span className="connector-line" />
          <span><strong>{stop.walkFromPrevious.minutes} min</strong> · {formatDistance(stop.walkFromPrevious.meters)} walking</span>
        </div>
      )}
      <article className={`stop-card ${isCurrent ? 'is-current' : ''} ${isClosed ? 'is-closed' : ''}`}>
        <div className="stop-number">{stop.sequence.toString().padStart(2, '0')}</div>
        <div className="stop-card-body">
          <div className="stop-card-topline">
            <span className="stop-kind">{KIND_SYMBOLS[place.kind]} {KIND_LABELS[place.kind]}</span>
            <span className={`availability availability-${place.availability}`}>{place.availabilityLabel}</span>
          </div>
          <h3>{place.name}</h3>
          <p>{place.summary}</p>
          <div className="stop-card-details">
            <span>{place.address}</span>
            <span>{place.checkedAt}</span>
          </div>
          {place.mapsUrl && <a className="maps-link" href={place.mapsUrl} target="_blank" rel="noreferrer">View on Google Maps ↗</a>}
          <button className="repair-stop-button" type="button" onClick={onRequestRepair} disabled={repairDisabled}>
            {isRepairing ? 'Finding an alternative…' : isClosed ? 'Find a real replacement' : 'This place is unavailable'}
            <span aria-hidden="true">→</span>
          </button>
          {isClosed && <p className="availability-note">Buki will search real nearby places that keep your route constraints.</p>}
        </div>
      </article>
    </div>
  )
}

export default App
