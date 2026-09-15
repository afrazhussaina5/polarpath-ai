from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import os

from backend.models.schemas import (
    SeaIceForecast,
    IcebergDetection,
    RiskSummary,
    RiskGridCell,
    RiskWeights,
    RouteOptimizationRequest,
    RouteExplanation,
    VesselStatus,
    SystemStatusResponse
)

from backend.services.sea_ice_service import sea_ice_service
from backend.services.iceberg_service import iceberg_service
from backend.services.risk_engine import risk_engine
from backend.services.route_optimizer import route_optimizer
from backend.services.explainability_service import explainability_service
from backend.services.system_status_service import system_status_service

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="PolarPath AI API",
    description=(
        "AI-Enabled Antarctic Sea-Ice, Iceberg Trajectory, "
        "and Navigation Decision Support System "
        "(Team AXIOM - SIH 2026 Problem Statement 26059)"
    ),
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# STATIC FILES
# ============================================================

STATIC_DIR = os.path.join(
    os.path.dirname(__file__),
    "static"
)

if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static"
)


# ============================================================
# ROOT / HEALTH
# ============================================================

@app.get("/")
def root():
    """
    Root endpoint.
    Serves frontend index.html if available.
    """

    index_file = os.path.join(
        STATIC_DIR,
        "index.html"
    )

    if os.path.exists(index_file):
        return FileResponse(index_file)

    return {
        "project": "POLARPATH AI",
        "team": "AXIOM",
        "tagline": "THINK. BUILD. IMPACT.",
        "sih_problem_statement": "26059",
        "status": "OPERATIONAL",
        "documentation": "/docs"
    }


@app.get("/health")
def health_check():
    """
    Health check endpoint.
    """

    return {
        "status": "healthy",
        "service": "PolarPath AI",
        "team": "AXIOM",
        "version": "1.0.0"
    }


# ============================================================
# SEA ICE
# ============================================================

@app.get(
    "/api/v1/sea-ice/current",
    response_model=SeaIceForecast
)
def get_current_sea_ice():

    return sea_ice_service.generate_forecast("0h")


@app.get(
    "/api/v1/sea-ice/forecast",
    response_model=SeaIceForecast
)
def get_sea_ice_forecast(
    horizon: str = Query(
        "6h",
        pattern="^(0h|6h|12h|24h|48h)$"
    )
):

    return sea_ice_service.generate_forecast(horizon)


# ============================================================
# ICEBERGS
# ============================================================

@app.get(
    "/api/v1/icebergs",
    response_model=List[IcebergDetection]
)
def get_icebergs():

    return iceberg_service.get_all()


@app.get(
    "/api/v1/icebergs/{iceberg_id}",
    response_model=IcebergDetection
)
def get_iceberg_details(
    iceberg_id: str
):

    ib = iceberg_service.get_by_id(iceberg_id)

    if not ib:
        raise HTTPException(
            status_code=404,
            detail=f"Iceberg {iceberg_id} not found"
        )

    return ib


@app.get(
    "/api/v1/icebergs/{iceberg_id}/trajectory"
)
def get_iceberg_trajectory(
    iceberg_id: str
):

    ib = iceberg_service.get_by_id(iceberg_id)

    if not ib:
        raise HTTPException(
            status_code=404,
            detail=f"Iceberg {iceberg_id} not found"
        )

    return {
        "iceberg_id": ib.id,
        "name": ib.name,
        "trajectory": ib.predicted_trajectory,
        "uncertainty_corridor": ib.uncertainty_corridor,
        "confidence_pct": ib.trajectory_confidence_pct
    }


# ============================================================
# RISK MAP
# ============================================================

@app.get(
    "/api/v1/risk-map",
    response_model=List[RiskGridCell]
)
def get_risk_map(
    horizon: str = "0h"
):

    return risk_engine.generate_risk_map(horizon)


@app.get(
    "/api/v1/risk-summary",
    response_model=RiskSummary
)
def get_risk_summary(
    horizon: str = "0h"
):

    return risk_engine.get_risk_summary(horizon)


# ============================================================
# ROUTE OPTIMIZATION
# ============================================================

@app.post(
    "/api/v1/routes/optimize"
)
def optimize_routes(
    req: RouteOptimizationRequest
):

    return route_optimizer.optimize_routes(req)


@app.post(
    "/api/v1/routes/recalculate"
)
def recalculate_routes(
    req: Optional[RouteOptimizationRequest] = None
):

    if req is None:
        req = RouteOptimizationRequest()

    return route_optimizer.optimize_routes(req)


# ============================================================
# ROUTE EXPLANATION
# ============================================================

@app.get(
    "/api/v1/routes/explain/{route_id}",
    response_model=RouteExplanation
)
def explain_route(
    route_id: str
):

    return explainability_service.explain_route(
        route_id
    )


# ============================================================
# VESSEL STATUS
# ============================================================

@app.get(
    "/api/v1/vessel/status",
    response_model=VesselStatus
)
def get_vessel_status():

    return system_status_service.get_vessel_status()


# ============================================================
# SYSTEM STATUS
# ============================================================

@app.get(
    "/api/v1/system/status",
    response_model=SystemStatusResponse
)
def get_system_status():

    return system_status_service.get_system_status()


# ============================================================
# SIMULATION - SPAWN ICEBERG
# ============================================================

@app.post(
    "/api/v1/simulation/spawn-iceberg"
)
def spawn_simulated_iceberg():

    ib = iceberg_service.spawn_simulated_iceberg()

    recalculated = route_optimizer.optimize_routes(
        RouteOptimizationRequest()
    )

    return {
        "event": "NEW_HAZARD_OBSERVED",
        "message": (
            f"Critical SAR observation: {ib.name} "
            "detected drifting into active transit channel."
        ),
        "spawned_iceberg": ib,
        "routing_result": recalculated
    }


# ============================================================
# SIMULATION - RESET
# ============================================================

@app.post(
    "/api/v1/simulation/reset"
)
def reset_simulation():

    iceberg_service.reset_to_default_catalog()

    route_optimizer.reset_state()

    recalculated = route_optimizer.optimize_routes(
        RouteOptimizationRequest()
    )

    return {
        "event": "SIMULATION_RESET",
        "message": (
            "Environment reset to baseline nominal conditions."
        ),
        "routing_result": recalculated
    }


# ============================================================
# LOCAL DEVELOPMENT
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
