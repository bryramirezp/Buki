# Buki app

Frontend React + Vite + TypeScript. La Fase 1 deja un arranque mínimo con modo
`mock` y funciones server-side de Vercel; la experiencia móvil y el plan simulado se
construyen en la Fase 2.

## Desarrollo local

```powershell
npm install
npm run dev
```

Para ejecutar también las funciones `api/` localmente, usa Vercel CLI desde esta carpeta:

```powershell
npx vercel dev
```

La configuración opcional vive en `.env` y parte de `.env.example`:

```text
VITE_BUKI_MODE=mock
VITE_BUKI_API_URL=
VITE_GOOGLE_MAPS_API_KEY=

# Solo disponible para las funciones server-side; nunca uses VITE_ aquí.
BUKI_MODE=mock
LLM_API_KEY=
LLM_API_URL=
LLM_MODEL=
```
