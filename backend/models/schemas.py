from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Coordinates(BaseModel):
    lat: float
    lon: float

class Waypoint(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    eta_hours: float
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    ice_concentration_pct: float
    notes: Optional[str] = None

# Sea-Ice Models
class SeaIceGridCell(BaseModel):
    id: str
    lat: float
    lon: float
    concentration_pct: float
    thickness_m: float
    drift_speed_kts: float
    drift_bearing_deg: float
    risk_category: str  # LOW, MEDIUM, HIGH, CRITICAL

class SeaIceForecast(BaseModel):
    horizon: str  # "0h", "6h", "12h", "24h", "48h"
    timestamp: str
    confidence_pct: float
    model_name: str
    mean_concentration_pct: float
    max_thickness_m: float
    marginal_ice_zone_extent_km2: float
    grid_cells: List[SeaIceGridCell]

# Iceberg Models
class TrajectoryPoint(BaseModel):
    hour: int
    lat: float
    lon: float
    speed_kts: float
    bearing_deg: float
    uncertainty_radius_km: float

class UncertaintyCorridor(BaseModel):
    iceberg_id: str
    polygon_coords: List[Coordinates]

class IcebergDetection(BaseModel):
    id: str
    name: str
    source_sensor: str
    detected_at: str
    lat: float
    lon: float
    length_m: float
    width_m: float
    estimated_height_m: float
    estimated_draft_m: float
    iceberg_category: str  # "Growler", "Bergy Bit", "Medium Iceberg", "Large Tabular"
    detection_confidence_pct: float
    current_speed_kts: float
    drift_bearing_deg: float
    # Physics vectors
    wind_drag_kn: float
    ocean_current_drag_kn: float
    coriolis_force_kn: float
    sea_ice_damping_pct: float
    # Trajectory
    predicted_trajectory: List[TrajectoryPoint]
    uncertainty_corridor: UncertaintyCorridor
    trajectory_confidence_pct: float

# Risk Models
class RiskWeights(BaseModel):
    sea_ice_weight: float = 0.35
    iceberg_weight: float = 0.30
    weather_weight: float = 0.15
    uncertainty_weight: float = 0.10
    vessel_constraint_weight: float = 0.10

class RiskSummary(BaseModel):
    overall_risk_level: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    overall_risk_score: float  # 0 - 100
    sea_ice_risk_pct: float
    iceberg_risk_pct: float
    weather_risk_pct: float
    forecast_confidence_pct: float
    horizon: str

class RiskGridCell(BaseModel):
    lat: float
    lon: float
    risk_score: float
    risk_level: str
    primary_hazard: str

# Route Models
class RouteOptimizationRequest(BaseModel):
    vessel_id: str = "AXIOM-01"
    start_lat: float = -65.20
    start_lon: float = 75.80
    dest_lat: float = -69.41
    dest_lon: float = 76.19
    departure_time: str = "2026-09-07T12:00:00Z"
    vessel_speed_kts: float = 12.0
    fuel_available_tons: float = 420.0
    vessel_ice_class: str = "PC-5"
    priority: str = "safety"  # "safety", "fuel", "time", "balanced"
    weights: Optional[RiskWeights] = None

class RouteOption(BaseModel):
    id: str
    name: str
    type: str  # "recommended", "alternative_safety", "alternative_speed", "previous_rerouted"
    total_distance_nm: float
    eta_hours: float
    estimated_fuel_tons: float
    risk_score: float
    safety_score: float
    route_confidence_pct: float
    polar_code_compliance: str
    waypoints: List[Waypoint]
    route_polyline: List[Coordinates]
    summary_reasons: List[str]

class RouteExplanation(BaseModel):
    route_id: str
    route_name: str
    recommendation_status: str
    primary_rationale: List[str]
    hazard_avoidance_details: List[Dict[str, Any]]
    alternative_comparisons: List[Dict[str, Any]]
    polar_code_assessment: Dict[str, Any]
    uncertainty_impact: str

# Vessel Telemetry
class VesselStatus(BaseModel):
    vessel_name: str
    callsign: str
    imo_number: str
    ice_class: str
    operational_status: str
    current_lat: float
    current_lon: float
    destination: str
    destination_lat: float
    destination_lon: float
    speed_kts: float
    heading_deg: float
    fuel_remaining_tons: float
    fuel_capacity_tons: float
    active_route_id: str
    active_alert: Optional[str] = None

# Telemetry
class DataSourceStatus(BaseModel):
    name: str
    category: str
    status: str
    mode: str  # LIVE_DATA, HISTORICAL_DATA, SIMULATED_DEMO
    latency_seconds: int
    last_updated: str
    details: str

class SystemComponentStatus(BaseModel):
    name: str
    status: str  # READY, ACTIVE, DEGRADED, OFFLINE
    category: str
    details: str

class AIModelStatus(BaseModel):
    module_name: str
    model_architecture: str
    status: str
    validation_status: str
    input_resolution: str
    inference_latency_ms: int

class SystemStatusResponse(BaseModel):
    system_version: str
    platform_name: str
    environment_disclaimer: str
    data_sources: List[DataSourceStatus]
    system_components: List[SystemComponentStatus] = Field(default_factory=list)
    ai_models: Optional[List[AIModelStatus]] = Field(default_factory=list)
    dynamic_risk_engine_status: str
    route_optimizer_status: str
