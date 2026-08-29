# Buki Vercel Functions

These functions are Buki's minimal server-side boundary. They are deployed alongside
the frontend on Vercel and are intended to protect the LLM key and coordinate calls
that must not run in the browser.

Google Maps is prepared for the frontend with a key restricted by domain, APIs, and
quotas. The concrete LLM provider integration remains separate from the interface so
the provider can be selected once its URL, model, and API format are defined.
