# Buki — Product Contract

Status: Phase 0 defined
Date: August 28, 2026
Initial validation scenario: Santiago Center, Chile.

## 1. Product promise

> Buki turns “what can I do right now?” into a realistic, adaptable walking plan.

The person writes in natural language what they want to do, how much time they have, and how far they are willing to walk. Buki combines that intent with real places, opening information, and routes to deliver a small route they can follow right now.

If a stop becomes unavailable, Buki reports that state clearly and can propose a verified nearby replacement. It never changes the route until the person confirms the visible proposal.

### What “realistic” means

- Places exist and come from an identifiable geographic source.
- The route uses walking times and distances calculated by a map provider.
- The plan respects available time and maximum distance per leg.
- Opening status is shown with its source and query time when available.
- AI explains and coordinates; it does not invent places, opening information, or distances.

## 2. User and job to be done

### Initial user

A person traveling alone or exploring their own city wants to decide what to do over the next few hours without building an itinerary from scratch. Buki is designed to work in any city with coverage and data from the map provider; the first validation will take place in Santiago.

### Problem

The person does not need a twenty-page travel guide. They need an executable decision now: where to go first, how far they will walk, what to do next, and what to do if a place is closed.

### Main entry phrase — initial validation example

> “I am in Santiago Center, near Plaza de Armas. I have the whole afternoon. I want to eat something local, visit two interesting places, and walk no more than twenty minutes between each stop. Give me a plan that works today.”

This phrase is a test example, not a reservation or a fixed recommendation. Places and hours must be queried at runtime.

## 3. Validation scenario: Santiago

### Happy path

1. The person opens Buki on their phone in the city where they are; the first test will be in Santiago Center.
2. They authorize location access or choose a point on the map.
3. They write their intent in a single text box.
4. Buki identifies the constraints: starting point, available time, interests, and maximum walking distance.
5. Buki queries nearby places, opening status, and walking routes.
6. Buki shows a route with two or three stops on the map.
7. The person taps “Go to next stop,” and Buki keeps the map embedded, showing their position, route, and next stop without taking them out of the app.

### Repair event

During the route, the person reports:

> “The museum you recommended is closed.”

Buki must:

- mark that stop as unavailable;
- search for a nearby open cultural alternative, if one exists;
- preserve the starting point, remaining time, and maximum walking distance;
- recalculate affected legs;
- clearly show what changed and why;
- offer a manual option when it cannot verify an alternative.

## 4. MVP boundaries

### Included

- A responsive web experience optimized for mobile.
- One main use case: a spontaneous walking plan within a single city, initially validated in Santiago Center.
- Natural-language input.
- Current location or a point selected on the map.
- Two or three stops per plan.
- Real places, available opening information/status, and walking routes.
- Embedded visual map and “next stop” panel.
- Walking route and current position inside Buki, without requiring an app switch.
- Repair of an unavailable stop.
- WebMCP so an agent can inspect, propose, and repair the plan.
- Equivalent manual controls when WebMCP is unavailable.
- Real provider data for the running experience and field test; unavailable data is stated explicitly rather than substituted with invented places.

### Explicitly out of the MVP

- Buying tickets, booking restaurants, or paying for services.
- Booking flights, hotels, or transfers.
- Custom turn-by-turn navigation.
- Multi-day trip planning.
- A guarantee of coverage or availability in every city worldwide, or alternative providers to the initial one.
- Exhaustive news and social-media tracking.
- Personal-safety promises or medical recommendations.
- Login, profiles, social network, synchronized favorites, or monetization.
- A second map provider in the interface.

## 5. Accepted conceptual architecture

```text
Intent + location
        ↓
Structured constraints
        ↓
Real places + status
        ↓
Walking routes
        ↓
Verifiable planner
        ↓
Mobile plan
        ↓
Repair when a stop changes
```

Google Maps/Places/Routes is the initial source for the map, places, and routes. The LLM is not the source of geographic truth: it interprets the request and writes the explanation about data returned by the APIs.

The map and frontend-compatible Google Maps requests can run in the browser using a key restricted by domain, APIs, and quotas. The LLM key remains exclusively in a Vercel server-side function; a separate FastAPI server is not required. The city is an operational parameter, not a conceptual product limitation. Effective coverage, available fields, and data quality depend on Google Maps in each location. Santiago is used as the MVP validation and field-test scenario.

WebMCP is an interaction layer for the agent, not the value proposition for the person. The initial tools are conceptually:

- `search_nearby_places`;
- `get_place_status`;
- `compute_walking_route`;
- `plan_walk`;
- `focus_stop`.

The challenge implementation expands this foundation with `set_origin`, `update_intent`, `advance_to_next_stop`, `propose_stop_repair`, and `get_buki_context`, for a current total of eleven registered tools. Buki's visual inspector lets people review schemas and status without making WebMCP a requirement for manual use.

## Post-MVP: expand WebMCP

The first version only needs the minimum capabilities to build, read, and repair a walking plan. The full scope of WebMCP inside Buki remains a research task: what other parts of the experience could an agent inspect, coordinate, or adapt beyond repairing a stop?

This exploration may include planning, location context, preferences, changes during the walk, decision explanations, and coordination with external services. Those tools will not be designed or implemented during this MVP; first validate that the core route is valuable to the person.

## 6. Success criteria

The MVP is successful if a person who has not inspected the code can complete this story:

> From a phone, describe an afternoon walking plan in a city covered by the map provider; receive two or three real stops, understand their order, follow the route in Buki's embedded map, and replace a closed stop without rebuilding the entire plan.

The first demonstration of this story will take place in Santiago Center.

### Observable criteria

1. **Immediate understanding:** within the first few seconds, it is clear that Buki answers what to do now, where to go, and how to walk between places.
2. **Natural input:** the main scenario can start by writing a sentence, without completing a long form.
3. **Geographic reality:** every displayed stop has an identifier or link from the place provider; invented places are not accepted.
4. **Valid route:** the plan does not exceed available time or the declared maximum walking distance per leg.
5. **Verifiable status:** each place indicates open, closed, unknown, or last checked; an assumption is never presented as certainty.
6. **Repair:** when a stop is marked closed, the system preserves constraints and offers an alternative or explains why it cannot.
7. **Mobile use:** the complete story works in an approximately 390×844 viewport without horizontal zoom or inaccessible buttons.
8. **Continuity:** the map stays inside Buki and shows current position, active leg, next stop, and estimated time without requiring an app switch.
9. **Agent and human:** the same capabilities exist through WebMCP and manual controls; the agent cannot change the plan without the person seeing the result.
10. **Controlled cost:** queries are limited per session and per day; the app does not call an API for every keystroke.

## 7. Field test

The first real test will take place in Santiago Center with a person walking and a real phone. Record:

- time from the request to the first plan;
- whether the person understands the next stop and can follow the map without outside explanation or an app switch;
- difference between estimated distance and perceived experience;
- number of manual corrections;
- behavior when a place is closed or cannot be verified;
- API usage per session;
- whether the person would use Buki again to decide what to do now.

The test will not attempt to prove that Buki replaces Google Maps as a mapping platform. It will test whether Buki reduces the friction between having free time and starting a concrete experience, keeping map, context, and next action on one screen.

## 8. Stop rule

The MVP will not expand to reservations, news, multi-city routes, or multiple providers until the single-city story works end to end on a phone with real data and verifiable repair. The first validation of that story will be in Santiago Center.

WebMCP expansion will be reviewed after that validation as a separate discovery stage, not as a reason to increase the current scope.
