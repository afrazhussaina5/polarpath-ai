from typing import Dict, Any, List
from models.schemas import RouteExplanation
from services.iceberg_service import iceberg_service

class ExplainabilityService:
    def explain_route(self, route_id: str) -> RouteExplanation:
        has_hazard = "IB-042" in iceberg_service.icebergs
        rid = (route_id or "").upper()

        if "CHARLIE" in rid:
            return RouteExplanation(
                route_id="ROUTE-CHARLIE-REOPTIMIZED",
                route_name="Route Charlie (Eastern Avoidance Lead [ACTIVE RE-ROUTE])",
                recommendation_status="RECOMMENDED",
                primary_rationale=[
                    "Predicted Iceberg Intercept Avoidance: Maintains a safe buffer of 16.5 NM outside the 95% confidence corridor of drifting tabular iceberg IB-042.",
                    "Sea-Ice Compression Minimization: Routes through opening coastal polynya leads (SIC 24-48%) along Ingrid Christensen Coast, avoiding compressive ridges.",
                    "Fuel vs Safety Pareto Dominance: Incurs only 14.2 NM (+5.5%) distance penalty while reducing vessel collision risk score from 86.4 (CRITICAL) to 21.4 (LOW).",
                    "IMO Polar Code Compliance: Polar Operational Limit Assessment Risk Indexing System (POLARIS) RIO score is +14.8, well above the operational safety threshold (0.0).",
                    "Navigational Resilience: Trajectory corridor uncertainty analysis indicates a 98.4% probability of remaining in open/navigable water."
                ],
                hazard_avoidance_details=[
                    {
                        "hazard_name": "Tabular Iceberg IB-042",
                        "threat_level": "CRITICAL",
                        "closest_point_of_approach_nm": 16.5,
                        "time_to_closest_point_hrs": 14.2,
                        "mitigation_action": "Detour 12 NM eastward around the predicted drift corridor envelope"
                    },
                    {
                        "hazard_name": "Consolidated Pack Ice Ridge (Prydz Central)",
                        "threat_level": "MODERATE",
                        "closest_point_of_approach_nm": 8.0,
                        "time_to_closest_point_hrs": 18.0,
                        "mitigation_action": "Utilizes coastal tidal lead opened by easterly katabatic offshore drift"
                    }
                ],
                alternative_comparisons=[
                    {
                        "route_name": "Route Alpha (Previous Direct Track)",
                        "evaluation": "REJECTED (CRITICAL HAZARD)",
                        "rejection_reasons": [
                            "Direct collision intercept: Trajectory models show IB-042 crossing Route Alpha at waypoint WP-03 between t+13h and t+16h.",
                            "Uncertainty corridor expands to 4.2 km width, fully engulfing Route Alpha's channel.",
                            "Estimated hull impact kinetic energy exceeds PC-5 structural threshold."
                        ]
                    },
                    {
                        "route_name": "Route Beta (Western Arc)",
                        "evaluation": "ACCEPTED ALTERNATIVE (SUB-OPTIMAL)",
                        "rejection_reasons": [
                            "Safely avoids IB-042, but incurs an unnecessary +35.6 NM distance penalty and +2.9 hours delay.",
                            "Higher fuel consumption (52.0 tons vs 45.4 tons on Route Charlie)."
                        ]
                    }
                ],
                polar_code_assessment={
                    "vessel_ice_class": "PC-5 (Medium first-year ice)",
                    "polaris_rio_score": "+14.8 (Normal Operations Authorized)",
                    "icebreaker_escort_required": False,
                    "max_safe_transit_speed_kts": 12.0
                },
                uncertainty_impact="Even under 95th-percentile extreme ocean current dispersion (0.95 kts WNW), the closest point of approach to IB-042 remains above 11.2 NM, exceeding the 5 NM safety margin."
            )
        elif "BETA" in rid:
            return RouteExplanation(
                route_id="ROUTE-BETA-SAFETY",
                route_name="Route Beta (Safety-First Western Arc)",
                recommendation_status="SAFETY-FIRST OPTIMIZATION",
                primary_rationale=[
                    "Maximum Hazard Standoff Distance: Passes >35 NM west of the primary iceberg drift corridor, reducing encounter risk to <5%.",
                    "Bathymetric Deep-Water Trough: Follows the Amery depression where compressive multi-year ice ridges do not ground.",
                    "Katabatic Wind Leeward Margin: Protected by western coastal topography from severe easterly storm surges.",
                    "Highest Safety Score: Achieves 94.5% safety index, the highest among all calculated route alternatives."
                ],
                hazard_avoidance_details=[
                    {
                        "hazard_name": "Tabular Iceberg IB-089 & Pack Ridge",
                        "threat_level": "LOW",
                        "closest_point_of_approach_nm": 34.8,
                        "time_to_closest_point_hrs": 12.0,
                        "mitigation_action": "Wide westerly bypass around ice shelf margin"
                    }
                ],
                alternative_comparisons=[
                    {
                        "route_name": "Route Alpha (Direct Lead)",
                        "evaluation": "FASTER BUT ELEVATED CONVERGENCE",
                        "rejection_reasons": [
                            "Passes closer to active shear zones in central Prydz Bay.",
                            "Safety score is 88.2% vs 94.5% on Route Beta."
                        ]
                    },
                    {
                        "route_name": "Route Gamma (Direct Rhumb Line)",
                        "evaluation": "REJECTED (EXCESSIVE RISK)",
                        "rejection_reasons": [
                            "Cuts through dense coastal pack ice (up to 82% SIC).",
                            "Unacceptable risk profile during polar darkness or fog."
                        ]
                    }
                ],
                polar_code_assessment={
                    "vessel_ice_class": "PC-5",
                    "polaris_rio_score": "+18.4 (Optimal Safety Clearance)",
                    "icebreaker_escort_required": False,
                    "max_safe_transit_speed_kts": 12.0
                },
                uncertainty_impact="Wide spatial standoff accommodates up to 300% trajectory model dispersion without safety boundary violation."
            )
        elif "GAMMA" in rid:
            return RouteExplanation(
                route_id="ROUTE-GAMMA-SPEED",
                route_name="Route Gamma (Direct Rhumb Line - Fastest Safe)",
                recommendation_status="SPEED-OPTIMIZED TRACK",
                primary_rationale=[
                    "Minimum Voyage Duration: Shortest distance (241.0 NM) and fastest arrival time (20.1 hrs) to Bharati Station.",
                    "Direct Navigation Track: Avoids large directional turns, minimizing rudder drag and engine cycles.",
                    "Operational Feasibility: Navigable by PC-5 ice-strengthened hull under active ice-watch protocol."
                ],
                hazard_avoidance_details=[
                    {
                        "hazard_name": "Coastal Pack Ice Convergence",
                        "threat_level": "ELEVATED",
                        "closest_point_of_approach_nm": 4.2,
                        "time_to_closest_point_hrs": 14.0,
                        "mitigation_action": "Requires continuous hull strain monitoring and speed reduction to 6 kts in heavy floes"
                    }
                ],
                alternative_comparisons=[
                    {
                        "route_name": "Route Beta (Safety First)",
                        "evaluation": "SAFER BUT SLOWER",
                        "rejection_reasons": ["Incurs +51.0 NM extra distance and +4.2 hrs delay compared to Route Gamma."]
                    },
                    {
                        "route_name": "Route Alpha (Balanced Lead)",
                        "evaluation": "BALANCED ALTERNATIVE",
                        "rejection_reasons": ["Takes modest lead detour (+15.4 NM) to reduce ice friction."]
                    }
                ],
                polar_code_assessment={
                    "vessel_ice_class": "PC-5",
                    "polaris_rio_score": "+6.5 (Conditional Transit Authorized)",
                    "icebreaker_escort_required": False,
                    "max_safe_transit_speed_kts": 9.5
                },
                uncertainty_impact="Requires high-frequency SAR tactical updates every 6 hours due to tighter safety margins near pack floes."
            )
        elif "DELTA" in rid:
            return RouteExplanation(
                route_id="ROUTE-DELTA-FAR-EAST",
                route_name="Route Delta (Deep Lead Detour)",
                recommendation_status="EXTREME HAZARD AVOIDANCE",
                primary_rationale=[
                    "Zero Hazard Proximity: Diverts entirely outside the active Prydz Bay iceberg drift corridor.",
                    "Deep Navigable Water: Follows open ocean leads with sea-ice concentration < 25% for 80% of transit.",
                    "Guaranteed Mission Safety: Eliminates any encounter probability with uncataloged bergy bits."
                ],
                hazard_avoidance_details=[
                    {
                        "hazard_name": "All Active Icebergs",
                        "threat_level": "NEGLIGIBLE",
                        "closest_point_of_approach_nm": 48.0,
                        "time_to_closest_point_hrs": 16.0,
                        "mitigation_action": "Complete perimeter detour around the hazard zone"
                    }
                ],
                alternative_comparisons=[],
                polar_code_assessment={
                    "vessel_ice_class": "PC-5",
                    "polaris_rio_score": "+21.0 (Maximum Safety Rating)",
                    "icebreaker_escort_required": False,
                    "max_safe_transit_speed_kts": 13.0
                },
                uncertainty_impact="Completely immune to trajectory prediction errors due to vast standoff buffer (>45 NM)."
            )
        else:
            # Route Alpha (Default or Compromised)
            if has_hazard:
                return RouteExplanation(
                    route_id="ROUTE-ALPHA-COMPROMISED",
                    route_name="Route Alpha [COMPROMISED - COLLISION HAZARD]",
                    recommendation_status="REJECTED (UNSAFE)",
                    primary_rationale=[
                        "CRITICAL COLLISION RISK: Sentinel-1 SAR pass detected tabular iceberg IB-042 drifting directly toward waypoint WP-03.",
                        "Predicted point of intersection occurs at t+14.2h with an uncertainty corridor of 4.2 km.",
                        "RIO score drops to -4.2, which legally prohibits non-icebreaking transit under IMO Polar Code regulations."
                    ],
                    hazard_avoidance_details=[
                        {
                            "hazard_name": "Tabular Iceberg IB-042",
                            "threat_level": "CRITICAL",
                            "closest_point_of_approach_nm": 0.4,
                            "time_to_closest_point_hrs": 14.2,
                            "mitigation_action": "IMMEDIATE DIVERSION MANDATORY"
                        }
                    ],
                    alternative_comparisons=[
                        {
                            "route_name": "Route Charlie (Recommended Re-route)",
                            "evaluation": "SUPERIOR (SELECTED)",
                            "rejection_reasons": ["Selected due to 16.5 NM safe clearance and compliant POLARIS score."]
                        }
                    ],
                    polar_code_assessment={
                        "vessel_ice_class": "PC-5",
                        "polaris_rio_score": "-4.2 (Operation Prohibited without Heavy Icebreaker Escort)",
                        "icebreaker_escort_required": True,
                        "max_safe_transit_speed_kts": 3.0
                    },
                    uncertainty_impact="High probability (86.4%) of entering hazardous iceberg drift cone within the 24-hour forecast window."
                )
            else:
                return RouteExplanation(
                    route_id="ROUTE-ALPHA-BALANCED",
                    route_name="Route Alpha (Direct Central Polynya Lead)",
                    recommendation_status="RECOMMENDED (BALANCED)",
                    primary_rationale=[
                        "Optimal Navigable Track: Minimizes distance (256.4 NM) and transit time (21.4 hrs) to Bharati Station.",
                        "Lowest Fuel Consumption: Requires only 42.3 tons of MGO fuel, preserving 377.7 tons in reserve.",
                        "Safe Distance from Active Hazards: Standoff distance from known iceberg IB-089 exceeds 22 NM.",
                        "Favorable Sea-Ice Regime: Exploits central Prydz Bay lead channel with concentration < 45%.",
                        "Full IMO Polar Code Compliance: POLARIS RIO score is +16.2."
                    ],
                    hazard_avoidance_details=[
                        {
                            "hazard_name": "Tabular Iceberg IB-089",
                            "threat_level": "LOW",
                            "closest_point_of_approach_nm": 22.4,
                            "time_to_closest_point_hrs": 8.0,
                            "mitigation_action": "Safe clearance maintained along natural bathymetric trough"
                        }
                    ],
                    alternative_comparisons=[
                        {
                            "route_name": "Route Beta (Western Arc)",
                            "evaluation": "SECONDARY (CONSERVATIVE)",
                            "rejection_reasons": [
                                "Adds 35.6 NM distance without corresponding risk reduction in current calm meteorological conditions.",
                                "Increases fuel consumption by 18%."
                            ]
                        },
                        {
                            "route_name": "Route Gamma (Direct Rhumb Line)",
                            "evaluation": "REJECTED (ICE HAZARD)",
                            "rejection_reasons": [
                                "Cuts across multi-year fast ice ridge near Larsemann Hills.",
                                "Exceeds PC-5 independent transit thickness limit (requires ice ramming)."
                            ]
                        }
                    ],
                    polar_code_assessment={
                        "vessel_ice_class": "PC-5",
                        "polaris_rio_score": "+16.2 (Independent Operations Authorized)",
                        "icebreaker_escort_required": False,
                        "max_safe_transit_speed_kts": 12.0
                    },
                    uncertainty_impact="Forecast confidence along Route Alpha is 91.4% with low variance in ocean current and wind predictions."
                )

explainability_service = ExplainabilityService()
