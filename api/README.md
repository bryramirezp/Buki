# Buki Vercel Functions

These functions are Buki's minimal server-side boundary. They are deployed alongside
the frontend on Vercel and are intended to protect the LLM key and coordinate calls
that must not run in the browser.

Google Maps runs in the frontend with a key restricted by domain, APIs, and quotas.
`plan.ts` is an OpenAI-compatible LLM adapter configured with `LLM_API_KEY`,
`LLM_API_URL`, and `LLM_MODEL`. It optionally retries `LLM_FALLBACK_MODEL` when
the primary model fails. During `npm run dev`, Vite mounts the same handler at
`/api/plan` locally; Vercel deploys the handler unchanged.
