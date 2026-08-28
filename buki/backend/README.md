# Buki backend

FastAPI separado del frontend. En Fase 1 solo expone un contrato mínimo de salud,
configuración y un itinerario vacío para mantener el arranque reversible.

## Desarrollo local

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:BUKI_MODE = "mock"
uvicorn app.main:app --reload --port 8000
```

El frontend espera el backend en `http://127.0.0.1:8000` por defecto.
