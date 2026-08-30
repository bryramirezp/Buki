# Prior Work and Challenge-Period Work

This repository extends an earlier WebMCP prototype. The Buki product, its real-data
planning flow, and its current WebMCP capabilities were built during the OpenAI WebMCP
Challenge submission period, which began on August 25, 2026. This document separates
imported foundations, dated public-commit evidence, and current local verification so
reviewers can distinguish provenance from later hardening work.

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
| August 29, 2026 | `5ed2e27` | Enabled the agent-driven planning journey. |
| August 29, 2026 | `e1f2fb9` and `d69d54f` | Refined the itinerary setup and visible planning experience. |
| August 29, 2026 | `d4dbd00` | Simplified live planning feedback. |
| August 29, 2026 | `f2bd4bb` | Added verified stop-repair proposals with human confirmation. |

The baseline commit `e30bb7c` records the imported foundational files at the start of
this repository. The dated commits above then establish Buki's product model, real-data
flow, LLM adapter, agent journey, and repair interaction during the submission period.

## Current local hardening and verification

The working tree after the dated commits adds implementation hardening rather than a
separate inherited product:

- transactional origin changes and replans, preserving the visible route on failure;
- stable active-stop IDs, explicit all-closed repair handling, repair undo, and truthful
  snapshot semantics;
- renamed WebMCP tools with output schemas and pending-repair context;
- deterministic route-selection, limit, and progress modules that run without Google Maps;
- a simulated LLM/Maps flow test for route creation, repair, and undo; and
- a local browser verification on August 30, 2026 that created a real Santiago walking
  plan with Google Maps and the configured OpenRouter model.

These local changes should be committed before submission if they are to become public
commit evidence. Production and field verification remain distinct follow-up work.
