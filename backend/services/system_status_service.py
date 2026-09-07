from typing import List
from models.schemas import SystemStatusResponse, DataSourceStatus, AIModelStatus, VesselStatus, SystemComponentStatus
from config import DEFAULT_VESSEL, STATIONS
from services.iceberg_service import iceberg_service

class SystemStatusService:
    def get_system_status(self) -> SystemStatusResponse:
        sources: List[DataSourceStatus] = [
            DataSourceStatus(
                name="Copernicus Sentinel-1A/B SAR",
                category="SATELLITE / EARTH OBSERVATION",
                status="AVAILABLE",
                mode="SIMULATED_DEMO",
                latency_seconds=184,
                last_updated="2026-09-07T12:05:22Z",
                details="C-band Extra Wide (EW) swath mode, HH+HV dual polarization, 40m spatial resolution. Calibrated backscatter sigma-0."
            ),
            DataSourceStatus(
                name="Copernicus Sentinel-2 MSI",
                category="SATELLITE / EARTH OBSERVATION",
                status="AVAILABLE",
                mode="SIMULATED_DEMO",
                latency_seconds=420,
                last_updated="2026-09-07T10:15:00Z",
                details="Optical multi-spectral 10m/20m bands (B2, B3, B4, B8) for visual lead discrimination and coastal sea-ice albedo."
            ),
            DataSourceStatus(
                name="MODIS Aqua / Terra L1B",
                category="SATELLITE / EARTH OBSERVATION",
                status="AVAILABLE",
                mode="SIMULATED_DEMO",
                latency_seconds=310,
                last_updated="2026-09-07T11:30:00Z",
                details="Thermal infrared & visible broad-scale imagery (250m-1km) for polynya surface temperature mapping."
            ),
            DataSourceStatus(
                name="ECMWF ERA5 / High-Res Operational Weather",
                category="METEOROLOGICAL",
                status="CONNECTED",
                mode="SIMULATED_DEMO",
                latency_seconds=65,
                last_updated="2026-09-07T12:00:00Z",
                details="10m U/V wind vectors, 2m air temperature, mean sea-level pressure, snowfall rate, and surface friction velocity."
            ),
            DataSourceStatus(
                name="HYCOM + Mercator Global Ocean Analysis",
                category="OCEANOGRAPHIC",
                status="CONNECTED",
                mode="SIMULATED_DEMO",
                latency_seconds=85,
                last_updated="2026-09-07T12:00:00Z",
                details="Barotropic and baroclinic surface currents (0-50m layer), sea surface salinity, sea surface temperature, and wave height."
            ),
            DataSourceStatus(
                name="Vessel NMEA 0183 & AIS Stream",
                category="VESSEL TELEMETRY",
                status="CONNECTED",
                mode="LIVE_MOCK",
                latency_seconds=1,
                last_updated="2026-09-07T12:14:02Z",
                details="R/V AXIOM-01 GPS gyro-heading, SOG 12.0 kts, rudder angle, fuel flow meters, and hull strain sensor telemetry."
            )
        ]

        components: List[SystemComponentStatus] = [
            SystemComponentStatus(
                name="FastAPI Navigation Core API",
                status="ACTIVE",
                category="BACKEND SERVICE",
                details="Port 8000 REST & WebSocket event gateway, CORS-enabled, sub-second telemetry pipeline."
            ),
            SystemComponentStatus(
                name="Geospatial Ingestion Store",
                status="ACTIVE",
                category="DATA INGESTION",
                details="Polar stereo GeoTIFF/NetCDF ingestion parser with spatial index and caching."
            ),
            SystemComponentStatus(
                name="Dynamic Cost Surface / Risk Engine",
                status="ACTIVE",
                category="ANALYTICS ENGINE",
                details="Continuous ice-concentration & hydrodynamic drift risk grid evaluator."
            ),
            SystemComponentStatus(
                name="Multi-Objective A* Route Optimizer",
                status="READY",
                category="PATHFINDING ENGINE",
                details="Pareto graph solver with POLARIS ice regime safety bounds and fuel drift penalties."
            )
        ]

        return SystemStatusResponse(
            system_version="1.0.0-SIH2026-DEMO",
            platform_name="PolarPath AI: Antarctic Navigation Intelligence",
            environment_disclaimer="DECISION SUPPORT SYSTEM FOR QUALIFIED RESEARCH-VESSEL NAVIGATORS. NOT AN AUTONOMOUS SHIP-CONTROL SYSTEM. All satellite and meteorological feeds in this prototype are generated via high-fidelity synthetic Antarctic datasets clearly marked for hackathon evaluation.",
            data_sources=sources,
            system_components=components,
            ai_models=[],
            dynamic_risk_engine_status="ACTIVE",
            route_optimizer_status="READY"
        )

    def get_vessel_status(self) -> VesselStatus:
        has_hazard = "IB-042" in iceberg_service.icebergs
        active_route = "ROUTE-CHARLIE-REOPTIMIZED" if has_hazard else "ROUTE-ALPHA-BALANCED"
        alert = "CRITICAL: Drift hazard IB-042 detected intersecting Route Alpha. Re-routing recommended." if has_hazard else None

        return VesselStatus(
            vessel_name=DEFAULT_VESSEL["vessel_name"],
            callsign=DEFAULT_VESSEL["callsign"],
            imo_number=DEFAULT_VESSEL["imo_number"],
            ice_class=DEFAULT_VESSEL["ice_class"],
            operational_status="UNDERWAY - POLAR TRANSIT",
            current_lat=-65.20,
            current_lon=75.80,
            destination="Bharati Research Station (India)",
            destination_lat=STATIONS["bharati"]["lat"],
            destination_lon=STATIONS["bharati"]["lon"],
            speed_kts=DEFAULT_VESSEL["cruise_speed_kts"],
            heading_deg=174.5,
            fuel_remaining_tons=DEFAULT_VESSEL["fuel_remaining_tons"],
            fuel_capacity_tons=DEFAULT_VESSEL["fuel_capacity_tons"],
            active_route_id=active_route,
            active_alert=alert
        )

system_status_service = SystemStatusService()
