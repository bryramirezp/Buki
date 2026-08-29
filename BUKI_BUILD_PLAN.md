# Buki — Build Plan

Status: Phase 3 implemented; WebMCP foundation included; validation with a restricted Google Maps key is pending.
Initial validation scenario: Santiago Center, Chile.
Base document: [BUKI_PRODUCT_CONTRACT.md](./BUKI_PRODUCT_CONTRACT.md)

## 1. Product direction

Buki helps a person in any city decide what to do right now. They write their intent in natural language and receive a small walking route with real places, opening information, distances, and an alternative if something changes. The city is not fixed to Santiago: the experience can operate anywhere with coverage and data from the selected map provider.

> “I am in Santiago Center. I have the whole afternoon, want to eat something local, visit two interesting places, and walk no more than twenty minutes between each stop.”

The main experience happens inside Buki: the map is embedded in the application, like a mobility app. The user should not need to leave the app to understand the plan or follow the next stop.

WebMCP is an internal layer that lets an agent inspect and adapt the plan. It is not the product's primary promise.

## 2. Migration strategy

Complete files will not be copied between projects.

### Preserved from `proyecto-mapa-ia-local`

- Conceptual model for places and itineraries.
- Geographic discovery as a starting point.
- FastAPI as a historical architecture reference, not Buki's runtime.
- LLM provider abstraction.
- Prompt and structured JSON validation.
- Multi-city testing as a methodology.

### Preserved from the previous WebMCP prototype

- React, Vite, and TypeScript.
- WebMCP tool registration.
- Agent action history.
- Proposal → validation → confirmation pattern.
- Playwright E2E tests.
- Manual fallback when WebMCP is unavailable.

### Rewritten

- Click-based input, replaced with natural language.
- Mood and duration selectors, replaced with interpreted constraints.
- Visual coordinate line, replaced with real walking routes.
- Desktop layout, converted into a mobile-first experience.
- Browser-side LLM calls, moved to Vercel server-side functions to protect secrets and orchestration.
- The previous business context, refocused on a person exploring a city; Santiago is the first field validation.

### Kept outside the product until validation

- `proyecto-mapa-ia-local/` as a reference.
- The previous WebMCP prototype is not part of the new application.

The Buki application is now located at the repository root so Vercel can detect the Vite project automatically.

## 3. Target architecture

```text
Natural request + location
            ↓
Constraint extraction
            ↓
Real places and current status
            ↓
Walking routes
            ↓
Verifiable planner
            ↓
LLM explanation
            ↓
Map and next stop inside Buki
            ↓
Repair when a stop changes
```

### Layer responsibilities

- **Frontend:** captures intent, displays the map, presents the plan, and allows corrections.
- **Vercel server-side functions:** protect the LLM key, normalize responses, and coordinate orchestration that must not run in the browser.
- **Map provider:** provides places, coordinates, status, opening information, and routes.
- **Deterministic planner:** applies time, distance, ordering, and availability rules.
- **LLM:** interprets natural language and explains decisions using verified data.
- **WebMCP:** exposes product actions to an agent through structured contracts.

The LLM is never the source of truth for place names, opening information, or distances.

## 4. Initial provider decision

Google Maps Platform will be used end to end to validate the “real map” promise:

- Maps JavaScript API from the frontend for the embedded map.
- Places API for places and details, using the frontend-compatible mode where appropriate.
- Maps JavaScript API with the Places (New) and Routes libraries for browser-side place discovery and walking routes. The key is restricted to the deployed website and enabled APIs.

The browser Google Maps key is not treated as a secret: it will be restricted by domain, APIs, and quotas. The LLM will be called from a Vercel server-side function with `LLM_API_KEY`, which must never be included in `VITE_*` variables or the frontend bundle. A separate FastAPI server is not required for the MVP.

Google provides business status and current opening fields in Places, and `WALK` routes in Routes. The implementation must review requested fields, attributions, and current pricing at development time:

- [Places API](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)
- [Routes API](https://developers.google.com/maps/documentation/routes/compute-route-over)
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Places policies and attributions](https://developers.google.com/maps/documentation/places/web-service/policies)

### Cost controls

- Billing and a budget configured before consuming real data.
- Daily quotas and alerts.
- Field masks to request only the necessary fields.
- Search for candidates first and request details only for finalists.
- Never call an API for every keystroke.
- A fake adapter for tests.
- Do not download photos, reviews, or advanced data in the first route.

Mapbox, OpenStreetMap, and OSRM remain candidates for later evaluation. Multiple providers will not be implemented in parallel during the MVP.

## 5. Phased construction

### Phase 0 — Product contract

Status: complete.

Deliverable: [BUKI_PRODUCT_CONTRACT.md](./BUKI_PRODUCT_CONTRACT.md).

Defined:

- Product promise.
- User and problem.
- Initial validation scenario in Santiago Center.
- Happy path and repair event.
- MVP boundaries.
- Success criteria.
- Field test.
- Stop rule.

Scope does not expand while the main story is not working.

### Phase 1 — Reversible foundation

Objective: create the new application without breaking existing projects.

Steps:

1. Initialize Git at the repository root if it does not already exist.
2. Create a baseline commit.
3. Create the `feature/buki-local-mcp` branch.
4. Create the React, Vite, and TypeScript application at the repository root.
5. Create Vercel server-side functions in `api/` for health checks and future LLM orchestration.
6. Define environment variables for the server-side LLM, frontend Google Maps, and limits.
7. Define a `mock` mode for development and testing.
8. Verify that Buki's contract and documentation remain the active reference.

Phase output: Buki starts locally in simulated mode; Vercel functions define the LLM server-side boundary and Google Maps is prepared to run from the frontend. There is no separate FastAPI service.

### Phase 2 — Mobile experience with simulated data

Status: complete in mock mode.

Objective: validate that the experience is understandable before paying for APIs.

Steps:

1. Create a mobile-first screen with the map occupying most of the viewport.
2. Add a text box for user intent.
3. Add simulated current location and manual point selection.
4. Show a bottom panel with the plan.
5. Show two or three stops.
6. Show walking time between stops.
7. Show the “Next stop” card.
8. Show a closed stop and a simulated replacement.
9. Create a desktop view with the map and plan side by side.

Phase output: a person can understand the complete flow without knowing WebMCP or the architecture.

### Phase 3 — Real route with Google Maps

Status: implemented with a mock fallback; Google validation is pending a valid restricted key.

Objective: replace synthetic data with real geographic data in the selected city.

Steps:

1. Integrate the embedded Google Maps map.
2. Request geolocation with explicit consent.
3. Query nearby places using extracted categories.
4. Request details only for finalist candidates.
5. Query opening status and available hours.
6. Calculate real walking routes.
7. Draw the route, markers, and current position inside Buki.
8. Show the source and query time when necessary.
9. Handle denied permissions, empty results, quotas, and API errors.

Phase output: from a point in the selected city, Buki can show real places and a valid walking route inside the application.

Current implementation:

- `@googlemaps/js-api-loader` loads the Maps JavaScript API only when `VITE_GOOGLE_MAPS_API_KEY` exists.
- `Place.searchNearby()` searches candidates for food, culture, and outdoor activity; `fetchFields()` requests details only for finalists.
- `Place.isOpen()` and business status are shown as open, closed, or unknown.
- `Route.computeRoutes()` calculates a `WALKING` route with up to three stops and draws it inside Buki using the current Routes Library.
- A button requests device geolocation with browser consent; if denied, the manual point is kept.
- Without a key, permission, or after an API error, the experience falls back to mock data and explains the reason in the interface.
- The manual intent form sends natural-language requests to the Vercel function when `VITE_BUKI_MODE=real`.
- The server-side LLM adapter returns structured interests, time, walking, and stop-count constraints without inventing geographic facts.
- Google Maps uses those constraints to search real categories, calculate the route, and reject routes that exceed the requested limits.

### Phase 4 — Natural language and planning

Objective: turn a free-form sentence into a feasible plan.

Steps:

1. Extract a `TripRequest` structure:
   - origin;
   - start time;
   - available time;
   - interests;
   - optional budget;
   - maximum walking distance per leg;
   - pace or number of stops.
2. Ask for clarification only when an essential value is missing.
3. Query candidates using those constraints.
4. Calculate routes before ordering stops.
5. Apply deterministic time and distance rules.
6. Ask the LLM for a short explanation based on the validated plan.
7. Reject names or data that do not come from providers.
8. Show warnings when hours cannot be verified.

Phase output: the first local slice is implemented; the validation scenario can interpret natural language and use it to build a real Maps route. Richer candidate ranking and explanation generation remain follow-up work.

### Phase 5 — Minimal WebMCP

Status: foundation implemented in parallel for the challenge; manual natural-language planning is now connected to the server-side adapter.

Objective: allow an agent to use Buki's real capabilities.

Currently registered tools:

- `search_nearby_places`;
- `get_place_status`;
- `compute_walking_route`;
- `get_itinerary`;
- `propose_itinerary`;
- `replace_stop`;
- `focus_stop`;
- `set_origin`;
- `update_intent`;
- `advance_to_next_stop`;
- `get_buki_context`.

Steps:

1. Define descriptions and input schemas.
2. Mark read operations as read-only.
3. Make proposals visible before applying them.
4. Record each invocation and result in summarized form.
5. Keep equivalent manual controls.
6. Test errors, incomplete inputs, and the absence of WebMCP.

The page includes a visible inspector showing the eleven tools, their schemas, whether they were registered by `document.modelContext`, and a summary of recent calls. When the browser does not offer WebMCP, the inspector still shows local definitions and the manual experience remains operational.

A large tool catalog will not be implemented yet. Expanding WebMCP remains a discovery task after this flow is validated.

### Phase 6 — Stop repair

Objective: demonstrate adaptation without rebuilding the entire itinerary.

Steps:

1. Allow a stop to be marked closed or unavailable.
2. Identify affected legs.
3. Search for alternatives with the same intent.
4. Recalculate times and distances.
5. Preserve origin, available time, and maximum walking distance.
6. Show a before-and-after comparison.
7. Explain why the replacement was selected.
8. Allow the person to accept or undo the repair.
9. Show an “unknown” status when there is not enough evidence.

News and external sources will be evaluated later. A news item must not change the plan automatically without showing its source, date, and confidence level.

### Phase 7 — Verification, mobile, and deployment

Objective: demonstrate the product on a real phone, initially in Santiago.

Steps:

1. Unit tests for the planner.
2. Desktop E2E tests.
3. E2E tests in an approximately 390×844 mobile viewport.
4. Test with WebMCP available.
5. Manual test without WebMCP.
6. Geolocation test over HTTPS.
7. Route test in Santiago Center.
8. Verify attributions, privacy, and restricted keys.
9. Configure quotas and alerts.
10. Public HTTPS deployment.
11. Field test while walking with a real phone.

Deployment happens after the local route and mobile experience pass.

## 6. Definitive MVP test

A person opens Buki on their phone in Santiago Center and writes:

> “I have the whole afternoon, want to eat something local, visit two interesting places, and walk no more than twenty minutes between each stop. Give me a plan that works today.”

The test passes if:

1. Buki understands the intent without outside explanation.
2. The user can confirm their location.
3. Two or three real places appear.
4. The embedded map shows the complete route.
5. The plan respects available time and maximum walking distance.
6. Hours or statuses are shown with explicit uncertainty.
7. The user can identify the next stop.
8. They can follow the map without leaving Buki.
9. A closed stop can be replaced while preserving constraints.
10. The experience works both manually and through WebMCP.

## 7. Field-test metrics

- Time from opening the application to receiving the first plan.
- Time until the user understands the next action.
- Percentage of correctly identified places.
- Difference between estimated and observed walking time.
- Number of corrections required.
- Percentage of accepted repairs.
- API or geolocation errors.
- API usage per session.
- Whether the person would use Buki again to decide what to do now.

## 8. Stop rule and pending decisions

The first version stops after a complete story in Santiago Center. This validates the product in one concrete city; it does not make Santiago a permanent geographic restriction.

Do not add before that validation:

- reservations or payments;
- flights, hotels, or transfers;
- planning across multiple cities or days;
- custom turn-by-turn navigation;
- automatic news tracking;
- a second map provider;
- an expanded WebMCP tool catalog;
- accounts, profiles, or a social network.

After the field test, usage evidence will determine whether Buki needs to:

- expand WebMCP;
- add news or event sources;
- expand validation to other cities;
- add alternative providers;
- add booking features;
- keep Google Maps or evaluate Mapbox/OSM.
