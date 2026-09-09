from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any

from models.schemas import (
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
from services.sea_ice_service import sea_ice_service
from services.iceberg_service import iceberg_service
from services.risk_engine import risk_engine
from services.route_optimizer import route_optimizer
from services.explainability_service import explainability_service
from services.system_status_service import system_status_service

app = FastAPI(
    title="PolarPath AI API",
    description="AI-Enabled Antarctic Sea-Ice, Iceberg Trajectory, and Navigation Decision Support System (Team AXIOM - SIH 2026 Problem Statement 26059)",
    version="1.0.0"
)

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Setup static files directory
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/health")
def health_check():
    """Simple health check endpoint for Railway deployment."""
    return {
        "status": "healthy",
        "service": "PolarPath AI",
        "team": "AXIOM",
        "version": "1.0.0"
    }

@app.get("/")
def root():
    index_file = os.path.join(STATIC_DIR, "index.html")
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

# 1. SEA-ICE FORECASTING MODULE
@app.get("/api/v1/sea-ice/current", response_model=SeaIceForecast)
def get_current_sea_ice():
    """Returns current sea-ice concentration and thickness map (0h horizon)."""
    return sea_ice_service.generate_forecast("0h")

@app.get("/api/v1/sea-ice/forecast", response_model=SeaIceForecast)
def get_sea_ice_forecast(horizon: str = Query("6h", pattern="^(0h|6h|12h|24h|48h)$")):
    """Returns sea-ice forecast for horizon (6h, 12h, 24h, 48h)."""
    return sea_ice_service.generate_forecast(horizon)

# 2. ICEBERG INTELLIGENCE MODULE
@app.get("/api/v1/icebergs", response_model=List[IcebergDetection])
def get_icebergs():
    """Returns all detected icebergs in the Antarctic theater."""
    return iceberg_service.get_all()

@app.get("/api/v1/icebergs/{iceberg_id}", response_model=IcebergDetection)
def get_iceberg_details(iceberg_id: str):
    """Returns specific iceberg detection and physics drift vectors."""
    ib = iceberg_service.get_by_id(iceberg_id)
    if not ib:
        raise HTTPException(status_code=404, detail=f"Iceberg {iceberg_id} not found")
    return ib

@app.get("/api/v1/icebergs/{iceberg_id}/trajectory")
def get_iceberg_trajectory(iceberg_id: str):
    """Returns predicted trajectory and uncertainty corridor for iceberg."""
    ib = iceberg_service.get_by_id(iceberg_id)
    if not ib:
        raise HTTPException(status_code=404, detail=f"Iceberg {iceberg_id} not found")
    return {
        "iceberg_id": ib.id,
        "name": ib.name,
        "trajectory": ib.predicted_trajectory,
        "uncertainty_corridor": ib.uncertainty_corridor,
        "confidence_pct": ib.trajectory_confidence_pct
    }

# 3. DYNAMIC RISK ENGINE MODULE
@app.get("/api/v1/risk-map", response_model=List[RiskGridCell])
def get_risk_map(horizon: str = "0h"):
    """Returns dynamic risk raster cells across navigation zone."""
    return risk_engine.generate_risk_map(horizon)

@app.get("/api/v1/risk-summary", response_model=RiskSummary)
def get_risk_summary(horizon: str = "0h"):
    """Returns aggregate dynamic navigation risk score and component percentages."""
    return risk_engine.get_risk_summary(horizon)

# 4. ROUTE OPTIMIZATION MODULE
@app.post("/api/v1/routes/optimize")
def optimize_routes(req: RouteOptimizationRequest):
    """Calculates Pareto-optimal routes (Recommended, Safety-First, Fastest Safe)."""
    return route_optimizer.optimize_routes(req)

@app.post("/api/v1/routes/recalculate")
def recalculate_routes(req: Optional[RouteOptimizationRequest] = None):
    """Re-evaluates current route against updated hazard layers."""
    if req is None:
        req = RouteOptimizationRequest()
    return route_optimizer.optimize_routes(req)

# 5. EXPLAINABILITY MODULE
@app.get("/api/v1/routes/explain/{route_id}", response_model=RouteExplanation)
def explain_route(route_id: str):
    """Returns human-in-the-loop decision support explanation and hazard avoidance rationale."""
    return explainability_service.explain_route(route_id)

# 6. VESSEL & SYSTEM TELEMETRY
@app.get("/api/v1/vessel/status", response_model=VesselStatus)
def get_vessel_status():
    """Returns current vessel state, position, destination, and active route."""
    return system_status_service.get_vessel_status()

@app.get("/api/v1/system/status", response_model=SystemStatusResponse)
def get_system_status():
    """Returns ingestion pipelines, model readiness, and platform telemetry."""
    return system_status_service.get_system_status()

# 7. DEMO SCENARIO INTERACTIVE TRIGGERS
@app.post("/api/v1/simulation/spawn-iceberg")
def spawn_simulated_iceberg():
    """
    Hackathon Demo Trigger:
    Simulates detection of high-threat tabular iceberg IB-042 crossing Route Alpha.
    Triggers dynamic re-routing workflow.
    """
    ib = iceberg_service.spawn_simulated_iceberg()
    recalculated = route_optimizer.optimize_routes(RouteOptimizationRequest())
    return {
        "event": "NEW_HAZARD_OBSERVED",
        "message": f"Critical SAR observation: {ib.name} detected drifting into active transit channel.",
        "spawned_iceberg": ib,
        "routing_result": recalculated
    }

@app.post("/api/v1/simulation/reset")
def reset_simulation():
    """Resets the simulation catalog to baseline initial conditions."""
    iceberg_service.reset_to_default_catalog()
    route_optimizer.reset_state()
    recalculated = route_optimizer.optimize_routes(RouteOptimizationRequest())
    return {
        "event": "SIMULATION_RESET",
        "message": "Environment reset to baseline nominal conditions.",
        "routing_result": recalculated
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
