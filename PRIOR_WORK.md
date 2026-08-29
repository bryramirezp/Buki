# Prior Work and Challenge-Period Work

This repository extends an earlier WebMCP prototype. The Buki product, its real-data
planning flow, and its current WebMCP capabilities were built during the OpenAI WebMCP
Challenge submission period, which began on August 25, 2026.

## Prior work

The prior prototype supplied only reusable foundations:

- React, Vite, and TypeScript setup.
- The initial WebMCP registration pattern and call-history concept.
- General itinerary and map-interface exploration.

It did not provide Buki's current product model, real Google Maps workflow, LLM adapter,
or the agent-to-plan journey below.

## New work during the submission period

The following public commits provide dated evidence of the challenge-period work:

| Date (America/Santiago) | Commit | Contribution |
| --- | --- | --- |
| August 28, 2026 | `ae8463b` | Established the Buki foundation. |
| August 28, 2026 | `1c587a2` | Added the server-side function boundary. |
| August 28, 2026 | `f67be73` and `762fc9d` | Added real Google Maps place discovery and walking routes. |
| August 28, 2026 | `dcd9441` | Added Buki's WebMCP tool surface. |
| August 29, 2026 | `758fd26` | Connected LLM intent interpretation. |
| August 29, 2026 | `d488575` | Removed mock itinerary data for the real-data flow. |

The current follow-up work strengthens the agent journey: tools read live state, a
`plan_walk` action performs the LLM-to-Maps flow, contracts reflect actual side effects,
and the local developer server runs the same plan handler without Vercel.
