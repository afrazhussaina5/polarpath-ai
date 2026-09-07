import math
from typing import List, Dict, Tuple
from models.schemas import RiskWeights, RiskSummary, RiskGridCell
from services.sea_ice_service import sea_ice_service
from services.iceberg_service import iceberg_service

class RiskEngine:
    def __init__(self):
        self.default_weights = RiskWeights(
            sea_ice_weight=0.35,
            iceberg_weight=0.30,
            weather_weight=0.15,
            uncertainty_weight=0.10,
            vessel_constraint_weight=0.10
        )

    def evaluate_point_risk(
        self,
        lat: float,
        lon: float,
        horizon: str = "0h",
        weights: RiskWeights = None,
        vessel_ice_class: str = "PC-5"
    ) -> Tuple[float, str, str]:
        """
        Calculates composite risk (0-100), risk level (LOW/MED/HIGH/CRITICAL), and primary hazard.
        """
        if weights is None:
            weights = self.default_weights

        h_val = int(horizon.replace("h", ""))

        # 1. Sea-Ice Risk Component:
        # Distance to coast factor
        dist_factor = (lat - (-64.0)) / (-70.0 - (-64.0))
        dist_factor = max(0.0, min(1.0, dist_factor))
        sic = (dist_factor ** 1.3) * 90.0
        if lat < -68.8:
            sic = max(sic, 80.0)

        # Vessel capability threshold: PC-5 can safely operate up to 70% medium first-year ice
        ice_risk = (sic / 100.0) ** 1.5 * 100.0
        if vessel_ice_class == "PC-5" and sic > 75.0:
            ice_risk += (sic - 75.0) * 1.8
        ice_risk = min(100.0, ice_risk)

        # 2. Iceberg Proximity & Trajectory Risk Component:
        icebergs = iceberg_service.get_all()
        berg_risk = 0.0
        primary_hazard = "Open Water / Navigation Clear"

        if ice_risk > 45.0:
            primary_hazard = f"Pack Ice Convergence ({int(sic)}% SIC)"

        for ib in icebergs:
            # Check current position
            d_curr = math.hypot((lat - ib.lat) * 60.0, (lon - ib.lon) * 60.0 * math.cos(math.radians(lat)))
            
            # Check trajectory waypoints
            min_traj_dist = d_curr
            for tp in ib.predicted_trajectory:
                d_traj = math.hypot((lat - tp.lat) * 60.0, (lon - tp.lon) * 60.0 * math.cos(math.radians(lat)))
                if d_traj < min_traj_dist:
                    min_traj_dist = d_traj

            # Critical danger zone: within 5 NM of iceberg or its corridor
            if min_traj_dist < 4.0:
                berg_risk = max(berg_risk, 98.0 - min_traj_dist * 5.0)
                primary_hazard = f"Collision Threat: {ib.name[:18]} (< {round(min_traj_dist, 1)} NM)"
            elif min_traj_dist < 12.0:
                berg_risk = max(berg_risk, 75.0 - (min_traj_dist - 4.0) * 4.5)
                if berg_risk > ice_risk:
                    primary_hazard = f"Iceberg Drift Influence: {ib.id} ({round(min_traj_dist, 1)} NM)"
            elif min_traj_dist < 25.0:
                berg_risk = max(berg_risk, 40.0 - (min_traj_dist - 12.0) * 2.0)

        # 3. Weather / Katabatic Wind Risk Component:
        # Southern ocean winds increase with southern latitude & time
        wind_speed_kts = 18.0 + (lat - (-64.0)) / -6.0 * 14.0 + h_val * 0.25
        weather_risk = min(100.0, max(10.0, (wind_speed_kts / 45.0) * 100.0))

        # 4. Uncertainty Penalty:
        # Increases with lead time
        unc_penalty = min(100.0, 15.0 + h_val * 1.35)

        # 5. Vessel Constraint Risk:
        vessel_constraint_risk = 20.0
        if sic > 80.0:
            vessel_constraint_risk = 85.0

        # Weighted combination
        total_risk = (
            weights.sea_ice_weight * ice_risk +
            weights.iceberg_weight * berg_risk +
            weights.weather_weight * weather_risk +
            weights.uncertainty_weight * unc_penalty +
            weights.vessel_constraint_weight * vessel_constraint_risk
        )
        total_risk = round(max(5.0, min(100.0, total_risk)), 1)

        if total_risk < 30.0:
            level = "LOW"
        elif total_risk < 60.0:
            level = "MEDIUM"
        elif total_risk < 80.0:
            level = "HIGH"
        else:
            level = "CRITICAL"

        return total_risk, level, primary_hazard

    def generate_risk_map(self, horizon: str = "0h", weights: RiskWeights = None) -> List[RiskGridCell]:
        """
        Generates 2D risk raster cells across the navigation theater.
        """
        cells: List[RiskGridCell] = []
        lat_start, lat_end = -64.5, -70.2
        lon_start, lon_end = 72.0, 80.5

        lat_steps = 15
        lon_steps = 13

        d_lat = (lat_end - lat_start) / (lat_steps - 1)
        d_lon = (lon_end - lon_start) / (lon_steps - 1)

        for i in range(lat_steps):
            lat = lat_start + i * d_lat
            for j in range(lon_steps):
                lon = lon_start + j * d_lon
                score, level, hazard = self.evaluate_point_risk(lat, lon, horizon, weights)
                cells.append(RiskGridCell(
                    lat=round(lat, 4),
                    lon=round(lon, 4),
                    risk_score=score,
                    risk_level=level,
                    primary_hazard=hazard
                ))
        return cells

    def get_risk_summary(self, horizon: str = "0h", weights: RiskWeights = None) -> RiskSummary:
        """
        Computes the operational aggregate risk summary along the approach corridor.
        """
        # Sample points along the active navigation corridor
        sample_points = [
            (-65.5, 76.0),
            (-66.5, 76.0),
            (-67.5, 76.0),
            (-68.5, 76.1),
            (-69.2, 76.2)
        ]
        scores = []
        for lat, lon in sample_points:
            s, _, _ = self.evaluate_point_risk(lat, lon, horizon, weights)
            scores.append(s)

        mean_risk = round(sum(scores) / len(scores), 1)

        # Check if IB-042 (simulated critical hazard) is active
        has_ib042 = "IB-042" in iceberg_service.icebergs
        iceberg_sub_risk = 78.5 if has_ib042 else 34.0

        if mean_risk < 30.0:
            level = "LOW"
        elif mean_risk < 60.0:
            level = "MEDIUM"
        elif mean_risk < 80.0:
            level = "HIGH"
        else:
            level = "CRITICAL"

        confidences = {"0h": 92.0, "6h": 87.0, "12h": 81.0, "24h": 74.0, "48h": 63.0}
        conf = confidences.get(horizon, 75.0)

        return RiskSummary(
            overall_risk_level=level,
            overall_risk_score=mean_risk,
            sea_ice_risk_pct=round(mean_risk * 0.85, 1),
            iceberg_risk_pct=iceberg_sub_risk,
            weather_risk_pct=32.0,
            forecast_confidence_pct=conf,
            horizon=horizon
        )

risk_engine = RiskEngine()
