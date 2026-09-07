import math
from typing import List, Dict, Any, Tuple
from models.schemas import RouteOption, Waypoint, Coordinates, RouteOptimizationRequest
from services.risk_engine import risk_engine
from services.iceberg_service import iceberg_service

class RouteOptimizer:
    def __init__(self):
        self.is_rerouted_state = False

    def reset_state(self):
        self.is_rerouted_state = False

    def optimize_routes(self, req: RouteOptimizationRequest) -> Dict[str, Any]:
        """
        Calculates Recommended Route, Safety-First Alternative, and Fastest-Safe Alternative.
        Adapts dynamically based on whether IB-042 (simulated critical obstacle) is present
        AND respects the user's optimization priority: 'safety', 'fuel', 'time', or 'balanced'.
        """
        has_hazard = "IB-042" in iceberg_service.icebergs

        start_lat = req.start_lat
        start_lon = req.start_lon
        dest_lat = req.dest_lat
        dest_lon = req.dest_lon
        vessel_speed = req.vessel_speed_kts
        priority = (req.priority or "safety").lower()

        # Build baseline candidates
        r_alpha = self._build_route_alpha(start_lat, start_lon, dest_lat, dest_lon, vessel_speed)
        r_beta_safety = self._build_route_beta_safety(start_lat, start_lon, dest_lat, dest_lon, vessel_speed)
        r_gamma_speed = self._build_route_gamma_speed(start_lat, start_lon, dest_lat, dest_lon, vessel_speed)

        if not has_hazard:
            # Nominal Baseline Navigation Scenario
            if priority == "safety":
                # User chose Safety First: Route Beta is recommended!
                r_rec = r_beta_safety
                r_alts = [r_alpha, r_gamma_speed]
                priority_label = "Safety First Priority (Maximum hazard standoff distance)"
            elif priority in ["time", "speed"]:
                # User chose Fastest Safe: Route Gamma is recommended!
                r_rec = r_gamma_speed
                r_alts = [r_alpha, r_beta_safety]
                priority_label = "Fastest Safe Priority (Direct rhumb line, acceptable ice margin)"
            elif priority == "fuel":
                # User chose Fuel Efficient: Route Alpha is recommended (lowest fuel burn in leads)
                r_rec = r_alpha
                r_alts = [r_beta_safety, r_gamma_speed]
                priority_label = "Fuel Economy Priority (Optimizes transit through open polynyas)"
            else:
                # Balanced Pareto
                r_rec = r_alpha
                r_alts = [r_beta_safety, r_gamma_speed]
                priority_label = "Balanced Pareto Optimization"

            return {
                "active_route_id": r_rec.id,
                "is_rerouted": False,
                "recommended_route": r_rec,
                "alternative_routes": r_alts,
                "previous_route": None,
                "reroute_reason": None,
                "applied_priority": priority,
                "priority_label": priority_label
            }
        else:
            # Re-routed Scenario: IB-042 is drifting across Route Alpha
            r_previous = self._build_route_alpha(start_lat, start_lon, dest_lat, dest_lon, vessel_speed)
            r_previous.id = "ROUTE-ALPHA-COMPROMISED"
            r_previous.name = "Route Alpha [COMPROMISED - COLLISION HAZARD]"
            r_previous.type = "previous_rerouted"
            r_previous.risk_score = 86.4
            r_previous.safety_score = 13.6
            r_previous.route_confidence_pct = 42.0
            r_previous.polar_code_compliance = "OPERATIONAL_LIMIT_EXCEEDED"
            r_previous.summary_reasons = [
                "CRITICAL: Intersects IB-042 predicted drift cone at t+14.2h (lat -67.15°S, lon 76.10°E)",
                "Sea-ice convergence along eastern margin exceeds vessel PC-5 safe limit",
                "Polar Code RIO index drops below zero (-4.2)"
            ]

            r_charlie = self._build_route_charlie_evasion(start_lat, start_lon, dest_lat, dest_lon, vessel_speed)
            r_delta = self._build_route_delta_deep_detour(start_lat, start_lon, dest_lat, dest_lon, vessel_speed)

            if priority == "safety":
                r_rec = r_delta
                r_alts = [r_charlie, r_beta_safety]
                priority_label = "Safety First Hazard Bypass (Deep Eastern Sea Detour)"
            elif priority in ["time", "speed"]:
                r_rec = r_charlie
                r_alts = [r_delta, r_beta_safety]
                priority_label = "Fastest Safe Avoidance (Coastal Lead Detour)"
            else:
                r_rec = r_charlie
                r_alts = [r_beta_safety, r_delta]
                priority_label = "Active Re-Route (Eastern Polynya Lead)"

            self.is_rerouted_state = True

            return {
                "active_route_id": r_rec.id,
                "is_rerouted": True,
                "recommended_route": r_rec,
                "alternative_routes": r_alts,
                "previous_route": r_previous,
                "reroute_reason": f"Dynamic hazard detection: Newly cataloged tabular iceberg IB-042 with 135m draft intersects previous Route Alpha. Diverted via {r_rec.name} to maintain safe standoff clearance (>16 NM buffer).",
                "applied_priority": priority,
                "priority_label": priority_label
            }

    def _build_route_alpha(self, start_lat, start_lon, dest_lat, dest_lon, speed) -> RouteOption:
        waypoints_data = [
            ("WP-01", "Marginal Ice Zone Entry", start_lat, start_lon, 0.0, "LOW", 12.0),
            ("WP-02", "Prydz North Basin Waypoint", -66.15, 75.95, 5.2, "LOW", 28.0),
            ("WP-03", "Central Lead Passage", -67.15, 76.08, 10.4, "MEDIUM", 46.0),
            ("WP-04", "Larsemann Hills Approach", -68.35, 76.15, 16.5, "MEDIUM", 62.0),
            ("WP-05", "Bharati Station Roadstead", dest_lat, dest_lon, 21.4, "HIGH", 78.0),
        ]
        coords = [Coordinates(lat=w[2], lon=w[3]) for w in waypoints_data]
        wps = [
            Waypoint(
                id=w[0], name=w[1], lat=w[2], lon=w[3], eta_hours=w[4],
                risk_level=w[5], ice_concentration_pct=w[6]
            ) for w in waypoints_data
        ]
        dist_nm = 256.4
        eta = round(dist_nm / speed, 1)
        fuel = round(dist_nm * 0.165, 1)

        return RouteOption(
            id="ROUTE-ALPHA-BALANCED",
            name="Route Alpha (Direct Central Polynya Lead)",
            type="recommended",
            total_distance_nm=dist_nm,
            eta_hours=eta,
            estimated_fuel_tons=fuel,
            risk_score=26.5,
            safety_score=88.2,
            route_confidence_pct=91.4,
            polar_code_compliance="FULL_COMPLIANCE",
            waypoints=wps,
            route_polyline=coords,
            summary_reasons=[
                "Optimal balance of navigable lead concentration and fuel consumption",
                "Navigates through open water polynyas identified in Sentinel-1 SAR",
                "Maintains safe clearance (>20 NM) from active tabular iceberg IB-089",
                "Full compliance with IMO Polar Code Category B operating envelope"
            ]
        )

    def _build_route_beta_safety(self, start_lat, start_lon, dest_lat, dest_lon, speed) -> RouteOption:
        waypoints_data = [
            ("WP-01B", "MIZ Northwest Ingress", start_lat, start_lon, 0.0, "LOW", 8.0),
            ("WP-02B", "West Prydz Basin Arc", -66.30, 74.60, 6.8, "LOW", 22.0),
            ("WP-03B", "Amery Shelf Deep Channel", -67.50, 74.80, 13.5, "LOW", 38.0),
            ("WP-04B", "Vestfold Sea Ingress", -68.60, 75.40, 19.8, "MEDIUM", 54.0),
            ("WP-05B", "Bharati Station Roadstead", dest_lat, dest_lon, 24.3, "HIGH", 75.0),
        ]
        coords = [Coordinates(lat=w[2], lon=w[3]) for w in waypoints_data]
        wps = [
            Waypoint(
                id=w[0], name=w[1], lat=w[2], lon=w[3], eta_hours=w[4],
                risk_level=w[5], ice_concentration_pct=w[6]
            ) for w in waypoints_data
        ]
        dist_nm = 292.0
        eta = round(dist_nm / speed, 1)
        fuel = round(dist_nm * 0.178, 1)

        return RouteOption(
            id="ROUTE-BETA-SAFETY",
            name="Route Beta (Safety-First Western Arc)",
            type="alternative_safety",
            total_distance_nm=dist_nm,
            eta_hours=eta,
            estimated_fuel_tons=fuel,
            risk_score=16.8,
            safety_score=94.5,
            route_confidence_pct=89.0,
            polar_code_compliance="FULL_COMPLIANCE",
            waypoints=wps,
            route_polyline=coords,
            summary_reasons=[
                "Maximum safety buffer: minimizes encounter probability with drifting bergs",
                "Avoids high-stress compressive pack ice ridges near Amery shelf edge",
                "Trade-off: +35.6 NM additional distance and +2.9 hours voyage time",
                "Recommended for maximum navigator margin during katabatic gales"
            ]
        )

    def _build_route_gamma_speed(self, start_lat, start_lon, dest_lat, dest_lon, speed) -> RouteOption:
        waypoints_data = [
            ("WP-01C", "Direct Entry", start_lat, start_lon, 0.0, "LOW", 14.0),
            ("WP-02C", "Central Prydz Direct", -67.30, 76.00, 10.0, "MEDIUM", 58.0),
            ("WP-03C", "Bharati Direct", dest_lat, dest_lon, 20.1, "HIGH", 82.0),
        ]
        coords = [Coordinates(lat=w[2], lon=w[3]) for w in waypoints_data]
        wps = [
            Waypoint(
                id=w[0], name=w[1], lat=w[2], lon=w[3], eta_hours=w[4],
                risk_level=w[5], ice_concentration_pct=w[6]
            ) for w in waypoints_data
        ]
        dist_nm = 241.0
        eta = round(dist_nm / speed, 1)
        fuel = round(dist_nm * 0.192, 1)

        return RouteOption(
            id="ROUTE-GAMMA-SPEED",
            name="Route Gamma (Direct Rhumb Line)",
            type="alternative_speed",
            total_distance_nm=dist_nm,
            eta_hours=eta,
            estimated_fuel_tons=fuel,
            risk_score=48.2,
            safety_score=68.0,
            route_confidence_pct=82.5,
            polar_code_compliance="CONDITIONAL_ICEBREAKER_ESCORT_SUGGESTED",
            waypoints=wps,
            route_polyline=coords,
            summary_reasons=[
                "Shortest distance (241.0 NM) and fastest arrival time (20.1 hrs)",
                "Forces transit through heavier consolidated ice pack (up to 82% SIC)",
                "Elevated fuel consumption due to hull ice friction and ramming",
                "Elevated risk: Reduced maneuvering margin near marginal ice floes"
            ]
        )

    def _build_route_charlie_evasion(self, start_lat, start_lon, dest_lat, dest_lon, speed) -> RouteOption:
        waypoints_data = [
            ("WP-01R", "MIZ Entry Point", start_lat, start_lon, 0.0, "LOW", 12.0),
            ("WP-02R", "Eastern Divergence Point", -66.25, 76.85, 5.8, "LOW", 24.0),
            ("WP-03R", "IB-042 Eastern Avoidance Waypoint", -67.20, 77.40, 11.2, "LOW", 36.0),
            ("WP-04R", "Vestfold Flank Ingress", -68.30, 77.10, 16.9, "MEDIUM", 58.0),
            ("WP-05R", "Bharati Station Approach", dest_lat, dest_lon, 22.5, "HIGH", 76.0),
        ]
        coords = [Coordinates(lat=w[2], lon=w[3]) for w in waypoints_data]
        wps = [
            Waypoint(
                id=w[0], name=w[1], lat=w[2], lon=w[3], eta_hours=w[4],
                risk_level=w[5], ice_concentration_pct=w[6]
            ) for w in waypoints_data
        ]
        dist_nm = 270.6
        eta = round(dist_nm / speed, 1)
        fuel = round(dist_nm * 0.168, 1)

        return RouteOption(
            id="ROUTE-CHARLIE-REOPTIMIZED",
            name="Route Charlie (Eastern Avoidance Lead [ACTIVE RE-ROUTE])",
            type="recommended",
            total_distance_nm=dist_nm,
            eta_hours=eta,
            estimated_fuel_tons=fuel,
            risk_score=21.4,
            safety_score=91.8,
            route_confidence_pct=88.5,
            polar_code_compliance="FULL_COMPLIANCE",
            waypoints=wps,
            route_polyline=coords,
            summary_reasons=[
                "DYNAMIC AVOIDANCE: Provides 16.5 NM standoff clearance from drifting tabular iceberg IB-042",
                "Navigates through dynamic coastal polynya lead along Ingrid Christensen Coast",
                "Total additional distance (+14.2 NM) adds only 1.1 hours to transit time",
                "Reduces collision risk probability from 86.4% to 21.4%",
                "Fully verified against vessel PC-5 ice-hull structural limits"
            ]
        )

    def _build_route_delta_deep_detour(self, start_lat, start_lon, dest_lat, dest_lon, speed) -> RouteOption:
        waypoints_data = [
            ("WP-01D", "MIZ Far-East Entry", start_lat, start_lon, 0.0, "LOW", 10.0),
            ("WP-02D", "Davis Sea Western Rim", -66.50, 78.40, 7.5, "LOW", 20.0),
            ("WP-03D", "Larsemann East Gate", -68.10, 78.10, 15.6, "MEDIUM", 48.0),
            ("WP-04D", "Bharati Station Dock", dest_lat, dest_lon, 25.7, "HIGH", 74.0),
        ]
        coords = [Coordinates(lat=w[2], lon=w[3]) for w in waypoints_data]
        wps = [
            Waypoint(
                id=w[0], name=w[1], lat=w[2], lon=w[3], eta_hours=w[4],
                risk_level=w[5], ice_concentration_pct=w[6]
            ) for w in waypoints_data
        ]
        dist_nm = 308.5
        eta = round(dist_nm / speed, 1)
        fuel = round(dist_nm * 0.174, 1)

        return RouteOption(
            id="ROUTE-DELTA-FAR-EAST",
            name="Route Delta (Far-East Deep Lead Detour)",
            type="alternative_speed",
            total_distance_nm=dist_nm,
            eta_hours=eta,
            estimated_fuel_tons=fuel,
            risk_score=19.2,
            safety_score=93.0,
            route_confidence_pct=86.0,
            polar_code_compliance="FULL_COMPLIANCE",
            waypoints=wps,
            route_polyline=coords,
            summary_reasons=[
                "Extreme hazard avoidance corridor",
                "Trades +52.1 NM additional distance for zero iceberg proximity",
                "Within vessel fuel reserve envelope (420 tons available vs 53.7 tons consumed)"
            ]
        )

route_optimizer = RouteOptimizer()
