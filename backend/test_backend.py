from fastapi.responses import FileResponse
from main import (
    root,
    get_current_sea_ice,
    get_sea_ice_forecast,
    get_icebergs,
    get_risk_map,
    get_risk_summary,
    optimize_routes,
    spawn_simulated_iceberg,
    explain_route,
    get_vessel_status,
    get_system_status,
    reset_simulation
)
from models.schemas import RouteOptimizationRequest

def test_direct():
    print("Testing PolarPath AI Backend Directly...")

    # Root
    r = root()
    assert isinstance(r, FileResponse) or "project" in r
    print("[PASS] Root passed (Serves SPA Single-Page Application)")

    # Current Sea Ice
    sic = get_current_sea_ice()
    assert len(sic.grid_cells) > 0
    print(f"[PASS] Current sea ice passed: {len(sic.grid_cells)} cells, mean conc: {sic.mean_concentration_pct}%")

    # Sea Ice Forecast 48h
    f48 = get_sea_ice_forecast("48h")
    assert f48.horizon == "48h"
    assert f48.confidence_pct == 63.5
    print(f"[PASS] 48h sea ice forecast passed, confidence: {f48.confidence_pct}%")

    # Icebergs
    bergs = get_icebergs()
    assert len(bergs) >= 3
    print(f"[PASS] Icebergs list passed: {len(bergs)} icebergs detected")

    # Risk Map
    risk_cells = get_risk_map("0h")
    assert len(risk_cells) > 0
    print(f"[PASS] Risk map passed: {len(risk_cells)} raster cells")

    # Route Optimize
    req = RouteOptimizationRequest(
        vessel_id="AXIOM-01",
        start_lat=-65.20,
        start_lon=75.80,
        dest_lat=-69.41,
        dest_lon=76.19,
        priority="safety"
    )
    opt = optimize_routes(req)
    assert "BETA" in opt["recommended_route"].id
    print(f"[PASS] Route optimization passed for Safety-First: {opt['recommended_route'].name}, Safety: {opt['recommended_route'].safety_score}%")

    # Route Optimize Balanced
    req_bal = RouteOptimizationRequest(priority="balanced")
    opt_bal = optimize_routes(req_bal)
    assert "ALPHA" in opt_bal["recommended_route"].id
    print(f"[PASS] Route optimization passed for Balanced: {opt_bal['recommended_route'].name}, Safety: {opt_bal['recommended_route'].safety_score}%")

    # Simulate New Iceberg (Dynamic Re-routing)
    event = spawn_simulated_iceberg()
    assert event["event"] == "NEW_HAZARD_OBSERVED"
    assert event["routing_result"]["is_rerouted"] is True
    print(f"[PASS] Hazard simulation passed: Re-routed to {event['routing_result']['recommended_route'].name}")

    # Explain Route
    exp = explain_route("ROUTE-CHARLIE-REOPTIMIZED")
    assert len(exp.primary_rationale) > 0
    print(f"[PASS] Explainability passed: {len(exp.primary_rationale)} rationale items, RIO: {exp.polar_code_assessment['polaris_rio_score']}")

    # Vessel & System Status
    vessel = get_vessel_status()
    assert vessel.vessel_name == "R/V AXIOM-01"
    sys_status = get_system_status()
    assert len(sys_status.data_sources) == 6
    print(f"[PASS] Telemetry passed: Vessel {vessel.vessel_name}, {len(sys_status.data_sources)} data sources")

    # Reset
    reset_res = reset_simulation()
    assert reset_res["event"] == "SIMULATION_RESET"
    print("[PASS] Reset passed")

    print("\n=======================================================")
    print("ALL POLARPATH AI BACKEND MODULES OPERATING FLAWLESSLY!")
    print("=======================================================")

if __name__ == "__main__":
    test_direct()
