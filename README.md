# Buki

Buki turns “what can I do right now?” into a realistic, adaptable walking plan.

The product is designed to work in any city with coverage and data from the selected map provider. A person describes what they want to do, how much time they have, and how far they are willing to walk. Buki proposes real places, keeps the route inside the app, and can repair a stop when its availability changes.

## Run locally

```powershell
npm install
npm run dev
```

To run the Vercel functions locally as well:

```powershell
npx vercel dev
```

Copy `.env.example` to `.env` and fill in the values you need. Never commit `.env` or expose server-side secrets with a `VITE_` prefix.

## Project documents

- [`BUKI_PRODUCT_CONTRACT.md`](./BUKI_PRODUCT_CONTRACT.md): product promise, user, boundaries, and success criteria.
- [`BUKI_BUILD_PLAN.md`](./BUKI_BUILD_PLAN.md): phases, architecture, verification, and stop rule.
- [`RULES.md`](./RULES.md): English summary of the WebMCP challenge rules.

## Current state

Phase 3 is implemented with optional Google Maps integration and a WebMCP foundation. Buki has a mobile-first experience with a mock fallback, consent-based geolocation, real place search, opening-status checks, walking routes, and a visible inspector for 11 tools. The next step is validating Maps with a restricted key and completing the LLM adapter.

## Configuration

```text
VITE_BUKI_MODE=mock
VITE_BUKI_API_URL=
VITE_GOOGLE_MAPS_API_KEY=

# Server-side only; never use VITE_ for these values.
BUKI_MODE=mock
LLM_API_KEY=
LLM_API_URL=
LLM_MODEL=
```

The app lives at the repository root so Vercel can detect the Vite project without a custom root-directory setting.

## WebMCP

Buki registers eleven tools through `document.modelContext.registerTool`. The “WebMCP · 11 tools” button opens an in-app inspector showing registration status, schemas, annotations, and recent calls. In a browser without WebMCP, the definitions remain visible and manual controls continue to work.
