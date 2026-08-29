# Buki

**Turn “what should I do today?” into a real, walkable itinerary.**

Buki starts with a real location and a natural-language idea—not a fictional route. It asks only for the details that make a plan practical, then uses Google Maps to find real nearby places and calculate a walking route.

## The experience

1. Choose your current location or drop a pin anywhere in the world.
2. Describe what you would enjoy in your own words.
3. Buki asks for time and walking comfort when they are missing.
4. Create a plan built from real places and real walking routes.

There are no hidden walking or time defaults. While Buki works, the page shows live activity: interpreting the request, finding places, checking details, calculating the route, and adding it to the map. These updates do not create extra Maps requests.

The map behaves like an app, with direct pan and zoom, native zoom/fullscreen controls, and bounded global navigation that prevents empty or duplicated world views.

## WebMCP: the same journey for an agent

Buki exposes eleven tools with `document.modelContext.registerTool`. A compatible browser agent can work with the person through the same visible experience:

1. Call `set_origin` after the person approves a location.
2. Call `plan_walk` with their intent. If duration or walking comfort is missing, it returns `needs_clarification` instead of querying Maps.
3. Call `plan_walk` again with `availableMinutes` and `maxWalkMinutes` once the person answers.
4. Read and guide the visible itinerary with `get_itinerary`, `get_place_status`, `compute_walking_route`, `focus_stop`, and `advance_to_next_stop`.
5. Call `propose_stop_repair` if a person says a stop is unavailable. Buki shows the real alternative and requires the person to confirm or keep the current route.

`search_nearby_places` only works after Buki has the person’s planning preferences, so an agent cannot create a route with invisible limits. The **WebMCP · 11 tools** button opens an in-app inspector with the browser-registered schemas and recent calls.

## Run locally

```powershell
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your values. `npm run dev` serves the Vite interface and a local adapter for `/api/plan`; no Vercel CLI or login is needed.

```text
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAPS_MAP_ID=
VITE_BUKI_API_URL=

# Server-side only. Never give these variables a VITE_ prefix.
BUKI_MODE=real
LLM_API_KEY=
LLM_API_URL=
LLM_MODEL=
```

The Google Maps JavaScript key is browser-visible by design, so restrict it by HTTP referrer and only enable the Maps APIs Buki uses. The LLM key remains server-side.

## Deploy to Vercel

Import this repository with the root directory set to `.`. Vercel detects the Vite app and deploys `api/plan.ts` as a Vercel Function automatically. Configure the variables above in Vercel; keep `LLM_API_KEY`, `LLM_API_URL`, and `LLM_MODEL` secret. Set `VITE_BUKI_API_URL` to empty when the function is served from the same deployment.

## Project documents

- [Product contract](./BUKI_PRODUCT_CONTRACT.md)
- [Build plan](./BUKI_BUILD_PLAN.md)
- [WebMCP challenge rules](./RULES.md)
- [Prior-work boundary](./PRIOR_WORK.md)
