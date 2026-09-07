import math
from typing import List, Tuple
from models.schemas import TrajectoryPoint, UncertaintyCorridor, Coordinates

class TrajectoryService:
    def __init__(self):
        self.omega = 7.2921e-5  # Earth's angular velocity in rad/s

    def compute_drift_physics(
        self,
        lat: float,
        lon: float,
        wind_speed_kts: float = 24.0,
        wind_dir_deg: float = 145.0,  # Katabatic wind from SSE
        current_speed_kts: float = 0.65,
        current_dir_deg: float = 275.0,  # East Wind Drift westward
        ice_concentration_pct: float = 55.0
    ) -> dict:
        """
        Physics-informed drift force components:
        F_total = F_wind + F_current + F_coriolis + F_ice_resistance
        """
        # Coriolis parameter in Southern Hemisphere (negative)
        phi_rad = math.radians(lat)
        f_coriolis = 2 * self.omega * math.sin(phi_rad)

        # Ice dampening factor: pack ice reduces drift velocity
        damping = max(0.2, 1.0 - (ice_concentration_pct / 100.0) * 0.7)

        # Wind drag contribution ~ 1.8% of wind speed, deflected ~30 deg to left in Southern Hemisphere
        v_wind_drift = wind_speed_kts * 0.018 * damping
        v_wind_dir = (wind_dir_deg - 30.0) % 360.0

        # Current drag contribution ~ 70% of current speed
        v_curr_drift = current_speed_kts * 0.75

        # Combined drift vector
        # decompose to North-South and East-West components (knots)
        u_wind = v_wind_drift * math.sin(math.radians(v_wind_dir))
        v_wind = v_wind_drift * math.cos(math.radians(v_wind_dir))

        u_curr = v_curr_drift * math.sin(math.radians(current_dir_deg))
        v_curr = v_curr_drift * math.cos(math.radians(current_dir_deg))

        u_net = u_wind + u_curr
        v_net = v_wind + v_curr

        net_speed = math.hypot(u_net, v_net)
        net_bearing = (math.degrees(math.atan2(u_net, v_net)) + 360.0) % 360.0

        return {
            "net_speed_kts": round(net_speed, 2),
            "net_bearing_deg": round(net_bearing, 1),
            "wind_drag_kn": round(v_wind_drift * 14.5, 1),
            "ocean_current_drag_kn": round(v_curr_drift * 28.0, 1),
            "coriolis_force_kn": round(abs(f_coriolis * 1e5 * net_speed * 8.5), 1),
            "sea_ice_damping_pct": round((1.0 - damping) * 100.0, 1)
        }

    def predict_trajectory(
        self,
        iceberg_id: str,
        initial_lat: float,
        initial_lon: float,
        speed_kts: float,
        bearing_deg: float,
        initial_confidence: float = 90.0
    ) -> Tuple[List[TrajectoryPoint], UncertaintyCorridor, float]:
        """
        Generates 0h, 6h, 12h, 24h, 48h trajectory points and bounding uncertainty corridor.
        Uncertainty grows non-linearly with forecast lead time (sigma ~ sqrt(t)).
        """
        hours = [0, 6, 12, 24, 48]
        trajectory: List[TrajectoryPoint] = []
        corridor_left: List[Coordinates] = []
        corridor_right: List[Coordinates] = []

        cur_lat = initial_lat
        cur_lon = initial_lon

        # 1 degree of latitude = 60 nautical miles
        # 1 degree of longitude = 60 * cos(lat) nautical miles
        for idx, h in enumerate(hours):
            if idx == 0:
                dt_hours = 0
            else:
                dt_hours = h - hours[idx - 1]

            # Slight Coriolis curve (turning leftward/counter-clockwise in South)
            turn_rate_deg_per_hour = -0.18
            effective_bearing = (bearing_deg + turn_rate_deg_per_hour * h) % 360.0

            dist_nm = speed_kts * dt_hours
            d_lat = (dist_nm * math.cos(math.radians(effective_bearing))) / 60.0
            cur_lat += d_lat

            mean_lat_rad = math.radians(cur_lat)
            cos_factor = max(0.2, math.cos(mean_lat_rad))
            d_lon = (dist_nm * math.sin(math.radians(effective_bearing))) / (60.0 * cos_factor)
            cur_lon += d_lon

            # Uncertainty radius in km: begins at 0.5 km (SAR resolution limit),
            # grows as sqrt(lead_time) + dispersion penalty
            unc_radius_km = round(0.6 + 1.15 * math.sqrt(h) + (100.0 - initial_confidence) * 0.04 * (h / 24.0), 2)

            trajectory.append(TrajectoryPoint(
                hour=h,
                lat=round(cur_lat, 4),
                lon=round(cur_lon, 4),
                speed_kts=round(speed_kts * (1.0 - 0.002 * h), 2),
                bearing_deg=round(effective_bearing, 1),
                uncertainty_radius_km=unc_radius_km
            ))

            # Calculate corridor envelope boundary points (perpendicular to drift direction)
            perp_bearing_left = (effective_bearing - 90.0) % 360.0
            perp_bearing_right = (effective_bearing + 90.0) % 360.0

            unc_radius_nm = unc_radius_km * 0.539957

            d_lat_left = (unc_radius_nm * math.cos(math.radians(perp_bearing_left))) / 60.0
            d_lon_left = (unc_radius_nm * math.sin(math.radians(perp_bearing_left))) / (60.0 * cos_factor)
            corridor_left.append(Coordinates(
                lat=round(cur_lat + d_lat_left, 4),
                lon=round(cur_lon + d_lon_left, 4)
            ))

            d_lat_right = (unc_radius_nm * math.cos(math.radians(perp_bearing_right))) / 60.0
            d_lon_right = (unc_radius_nm * math.sin(math.radians(perp_bearing_right))) / (60.0 * cos_factor)
            corridor_right.append(Coordinates(
                lat=round(cur_lat + d_lat_right, 4),
                lon=round(cur_lon + d_lon_right, 4)
            ))

        # Close polygon for the uncertainty corridor (forward on left, backward on right)
        polygon_coords = corridor_left + list(reversed(corridor_right)) + [corridor_left[0]]
        uncertainty_corridor = UncertaintyCorridor(
            iceberg_id=iceberg_id,
            polygon_coords=polygon_coords
        )

        overall_conf = round(initial_confidence * 0.82, 1)

        return trajectory, uncertainty_corridor, overall_conf

trajectory_service = TrajectoryService()
