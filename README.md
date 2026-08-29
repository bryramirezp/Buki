# Buki

Buki turns “what can I do right now?” into a realistic, adaptable walking plan.

The product is designed to work in any city with coverage and data from the selected map provider. A person describes what they want to do, how much time they have, and how far they are willing to walk. Buki proposes real places and keeps the route inside the app; it reports unavailable places without inventing replacements.

## Run locally

```powershell
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the values you need. Never commit `.env` or expose server-side secrets with a `VITE_` prefix.

`npm run dev` runs the Vite interface and a local adapter for `/api/plan` using the same LLM function that Vercel deploys. It reads the server-only `LLM_*` variables from `.env`; no Vercel login or CLI is required for local planning. Leave `VITE_BUKI_API_URL` empty locally; set it to the deployment origin only in production.

## Project documents

- [`BUKI_PRODUCT_CONTRACT.md`](./BUKI_PRODUCT_CONTRACT.md): product promise, user, boundaries, and success criteria.
- [`BUKI_BUILD_PLAN.md`](./BUKI_BUILD_PLAN.md): phases, architecture, verification, and stop rule.
- [`PRIOR_WORK.md`](./PRIOR_WORK.md): prior-work boundary and dated challenge-period evidence.
- [`RULES.md`](./RULES.md): English summary of the WebMCP challenge rules.

## Current state

Buki starts with no fictional location or itinerary: a person selects their device location or drops a point anywhere on the map, the LLM interprets their intent, and Google Maps supplies the real places and walking route. A compatible agent can perform that same end-to-end flow through ten WebMCP tools, with every plan change visible in the page.

## Configuration

```text
VITE_BUKI_API_URL=
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAPS_MAP_ID=

# Server-side only; never use VITE_ for these values.
BUKI_MODE=real
LLM_API_KEY=
LLM_API_URL=
LLM_MODEL=
```

The app lives at the repository root so Vercel can detect the Vite project without a custom root-directory setting.

Advanced Google Maps markers require a Map ID. Create one in the same Google Cloud project and set `VITE_GOOGLE_MAPS_MAP_ID`; the documented `DEMO_MAP_ID` fallback is used only when this variable is empty during local testing.

## WebMCP

Buki registers ten tools through `document.modelContext.registerTool`. The “WebMCP · 10 tools” button opens an in-app inspector showing browser-registered schemas, annotations, and recent calls. In a browser without WebMCP, the definitions remain visible and manual controls continue to work.

## Agent journey

An agent and person can collaborate without reproducing the plan manually:

1. `set_origin` places the route at a person-approved latitude and longitude.
2. `plan_walk` interprets the person’s natural-language request with the LLM, queries Google Maps, and makes the real plan visible in Buki.
3. The agent can inspect it with `get_itinerary`, focus a stop, read its status, or advance to the next leg.

Tools returning place-provider text are marked as third-party content. Tools that change the visible plan are not marked read-only.
