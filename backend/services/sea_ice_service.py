import math
from typing import List, Dict
from models.schemas import SeaIceForecast, SeaIceGridCell
from config import BOUNDS

class SeaIceService:
    def __init__(self):
        self.model_name = "ConvLSTM-SAR-Attention-v2.4 (Synthetic Pipeline)"
        self.confidence_by_horizon = {
            "0h": 94.2,
            "6h": 88.5,
            "12h": 81.3,
            "24h": 73.8,
            "48h": 63.5
        }

    def generate_forecast(self, horizon: str = "0h") -> SeaIceForecast:
        valid_horizons = ["0h", "6h", "12h", "24h", "48h"]
        if horizon not in valid_horizons:
            horizon = "0h"

        h_val = int(horizon.replace("h", ""))
        drift_offset_lat = 0.008 * (h_val / 6.0)  # Ice drifts slightly northwards under Antarctic divergence
        drift_offset_lon = -0.015 * (h_val / 6.0) # Westward East-Wind Drift

        grid_cells: List[SeaIceGridCell] = []
        total_conc = 0.0
        max_thick = 0.0

        # Create a grid covering lat -64 to -70.5 (step 0.45) and lon 72.0 to 80.5 (step 0.7)
        lat_steps = 14
        lon_steps = 12

        lat_start = -64.2
        lat_end = -70.2
        lon_start = 72.0
        lon_end = 80.5

        d_lat = (lat_end - lat_start) / (lat_steps - 1)
        d_lon = (lon_end - lon_start) / (lon_steps - 1)

        idx = 0
        for i in range(lat_steps):
            cur_lat = lat_start + i * d_lat
            for j in range(lon_steps):
                cur_lon = lon_start + j * d_lon
                idx += 1

                # Distance from coast / latitude factor
                # More negative latitude = closer to Antarctic continent (-70° is coastal, -64° is open ocean)
                coastal_proximity = (cur_lat - (-64.0)) / (-70.0 - (-64.0))
                coastal_proximity = max(0.0, min(1.0, coastal_proximity))

                # Longitudinal bay effect (Prydz Bay center around lon 75.0 - 77.0)
                bay_center = 76.0
                bay_factor = 1.0 - 0.25 * math.exp(-((cur_lon - bay_center) ** 2) / 4.0)

                # Horizon effect: Ice compression or drift
                time_wave = 0.08 * math.sin((cur_lon * 2.0 + h_val * 0.4) * math.pi / 180.0)
                
                # Base concentration
                base_conc = (coastal_proximity ** 1.3) * 92.0 * bay_factor + time_wave * 15.0
                # In deeper south (near Bharati at -69.4), SIC is high (75-92%)
                if cur_lat < -68.8:
                    base_conc = max(base_conc, 78.0 + (cur_lat - (-68.8)) * -12.0)

                conc = max(0.0, min(98.5, round(base_conc, 1)))
                total_conc += conc

                # Ice thickness: 0.1m in marginal zone up to 2.2m near coastal fast ice
                thickness = round(max(0.05, (conc / 100.0) ** 1.4 * 2.15), 2)
                if thickness > max_thick:
                    max_thick = thickness

                # Drift speed: 0.2 to 1.1 knots, drift bearing around 285° (WNW coastal current)
                drift_spd = round(0.4 + 0.5 * math.cos(cur_lat + h_val * 0.1), 2)
                drift_brg = round(280.0 + 15.0 * math.sin(cur_lon), 1)

                # Categorize
                if conc < 25.0:
                    risk_cat = "LOW"
                elif conc < 55.0:
                    risk_cat = "MEDIUM"
                elif conc < 80.0:
                    risk_cat = "HIGH"
                else:
                    risk_cat = "CRITICAL"

                grid_cells.append(SeaIceGridCell(
                    id=f"SIC_CELL_{idx:03d}",
                    lat=round(cur_lat + drift_offset_lat, 4),
                    lon=round(cur_lon + drift_offset_lon, 4),
                    concentration_pct=conc,
                    thickness_m=thickness,
                    drift_speed_kts=drift_spd,
                    drift_bearing_deg=drift_brg,
                    risk_category=risk_cat
                ))

        mean_conc = round(total_conc / len(grid_cells), 1)
        confidence = self.confidence_by_horizon.get(horizon, 75.0)

        return SeaIceForecast(
            horizon=horizon,
            timestamp=f"2026-09-07T{12 + h_val:02d}:00:00Z",
            confidence_pct=confidence,
            model_name=self.model_name,
            mean_concentration_pct=mean_conc,
            max_thickness_m=round(max_thick, 2),
            marginal_ice_zone_extent_km2=24800.0 + h_val * 140.0,
            grid_cells=grid_cells
        )

sea_ice_service = SeaIceService()
