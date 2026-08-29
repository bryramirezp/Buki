# Buki app

Frontend React + Vite + TypeScript. La Fase 3 integra opcionalmente Google Maps
desde el navegador y conserva datos simulados como fallback; las funciones
server-side de Vercel quedan disponibles para la orquestación del LLM.

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

Con una `VITE_GOOGLE_MAPS_API_KEY` válida y restringida por dominio/API, Buki
puede cargar el mapa real y el botón “Buscar lugares reales cerca”. Sin esa
variable, la aplicación inicia en modo mock sin hacer llamadas a Google Maps.
