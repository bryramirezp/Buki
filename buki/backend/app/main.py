import os
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


Mode = Literal["mock", "real"]


def read_mode() -> Mode:
    value = os.getenv("BUKI_MODE", "mock").lower()
    return value if value in {"mock", "real"} else "mock"  # type: ignore[return-value]


def read_cors_origins() -> list[str]:
    configured = os.getenv(
        "BUKI_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


mode = read_mode()
app = FastAPI(title="Buki API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=read_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": mode}


@app.get("/api/config")
def config() -> dict[str, str]:
    return {
        "mode": mode,
        "mapProvider": "mock" if mode == "mock" else "google-maps",
    }


@app.get("/api/itinerary")
def itinerary() -> dict[str, object]:
    """Return the empty mock contract until the planner is built in Phase 2."""
    return {
        "mode": mode,
        "status": "empty",
        "stops": [],
    }
