from typing import List, Optional, Dict
from models.schemas import IcebergDetection
from services.trajectory_service import trajectory_service

class IcebergService:
    def __init__(self):
        self.icebergs: Dict[str, IcebergDetection] = {}
        self.reset_to_default_catalog()

    def reset_to_default_catalog(self):
        """Initial synthetic SAR iceberg catalog (before hazard simulation)"""
        self.icebergs = {}

        # Iceberg 1: IB-089 (Large Tabular Iceberg to the North-West)
        p1 = trajectory_service.compute_drift_physics(
            lat=-66.45, lon=74.20, wind_speed_kts=22.0, wind_dir_deg=140.0,
            current_speed_kts=0.72, current_dir_deg=280.0, ice_concentration_pct=45.0
        )
        t1, c1, conf1 = trajectory_service.predict_trajectory(
            "IB-089", -66.45, 74.20, p1["net_speed_kts"], p1["net_bearing_deg"], initial_confidence=91.5
        )
        self.icebergs["IB-089"] = IcebergDetection(
            id="IB-089",
            name="Tabular Iceberg IB-089 (Calved Amery B-15 remnant)",
            source_sensor="Sentinel-1B C-SAR EW (HH+HV)",
            detected_at="2026-09-07T08:15:00Z",
            lat=-66.45,
            lon=74.20,
            length_m=1840.0,
            width_m=920.0,
            estimated_height_m=38.0,
            estimated_draft_m=165.0,
            iceberg_category="Large Tabular",
            detection_confidence_pct=94.8,
            current_speed_kts=p1["net_speed_kts"],
            drift_bearing_deg=p1["net_bearing_deg"],
            wind_drag_kn=p1["wind_drag_kn"],
            ocean_current_drag_kn=p1["ocean_current_drag_kn"],
            coriolis_force_kn=p1["coriolis_force_kn"],
            sea_ice_damping_pct=p1["sea_ice_damping_pct"],
            predicted_trajectory=t1,
            uncertainty_corridor=c1,
            trajectory_confidence_pct=conf1
        )

        # Iceberg 2: IB-104 (Medium Iceberg in Western Prydz)
        p2 = trajectory_service.compute_drift_physics(
            lat=-67.85, lon=73.50, wind_speed_kts=26.0, wind_dir_deg=150.0,
            current_speed_kts=0.55, current_dir_deg=290.0, ice_concentration_pct=62.0
        )
        t2, c2, conf2 = trajectory_service.predict_trajectory(
            "IB-104", -67.85, 73.50, p2["net_speed_kts"], p2["net_bearing_deg"], initial_confidence=88.0
        )
        self.icebergs["IB-104"] = IcebergDetection(
            id="IB-104",
            name="Medium Pinnacle Iceberg IB-104",
            source_sensor="Sentinel-1A C-SAR EW",
            detected_at="2026-09-07T09:40:00Z",
            lat=-67.85,
            lon=73.50,
            length_m=520.0,
            width_m=310.0,
            estimated_height_m=24.0,
            estimated_draft_m=98.0,
            iceberg_category="Medium Iceberg",
            detection_confidence_pct=89.2,
            current_speed_kts=p2["net_speed_kts"],
            drift_bearing_deg=p2["net_bearing_deg"],
            wind_drag_kn=p2["wind_drag_kn"],
            ocean_current_drag_kn=p2["ocean_current_drag_kn"],
            coriolis_force_kn=p2["coriolis_force_kn"],
            sea_ice_damping_pct=p2["sea_ice_damping_pct"],
            predicted_trajectory=t2,
            uncertainty_corridor=c2,
            trajectory_confidence_pct=conf2
        )

        # Iceberg 3: IB-115 (Bergy Bit Cluster in Eastern Sector)
        p3 = trajectory_service.compute_drift_physics(
            lat=-65.90, lon=78.60, wind_speed_kts=19.0, wind_dir_deg=135.0,
            current_speed_kts=0.48, current_dir_deg=270.0, ice_concentration_pct=35.0
        )
        t3, c3, conf3 = trajectory_service.predict_trajectory(
            "IB-115", -65.90, 78.60, p3["net_speed_kts"], p3["net_bearing_deg"], initial_confidence=84.5
        )
        self.icebergs["IB-115"] = IcebergDetection(
            id="IB-115",
            name="Bergy Bit Cluster IB-115 (Semi-submerged)",
            source_sensor="Sentinel-2 MSI (Band 8/4/3 Index)",
            detected_at="2026-09-07T10:15:00Z",
            lat=-65.90,
            lon=78.60,
            length_m=110.0,
            width_m=65.0,
            estimated_height_m=6.5,
            estimated_draft_m=34.0,
            iceberg_category="Bergy Bit",
            detection_confidence_pct=83.0,
            current_speed_kts=p3["net_speed_kts"],
            drift_bearing_deg=p3["net_bearing_deg"],
            wind_drag_kn=p3["wind_drag_kn"],
            ocean_current_drag_kn=p3["ocean_current_drag_kn"],
            coriolis_force_kn=p3["coriolis_force_kn"],
            sea_ice_damping_pct=p3["sea_ice_damping_pct"],
            predicted_trajectory=t3,
            uncertainty_corridor=c3,
            trajectory_confidence_pct=conf3
        )

    def spawn_simulated_iceberg(self) -> IcebergDetection:
        """
        Hackathon Demo Event:
        Injects a newly detected hazardous iceberg (IB-042) directly along the vessel's
        primary approach corridor towards Bharati Station.
        """
        # Positioned right along the nominal route (-67.15°S, 76.10°E)
        p = trajectory_service.compute_drift_physics(
            lat=-67.15, lon=76.10, wind_speed_kts=32.0, wind_dir_deg=160.0,
            current_speed_kts=0.88, current_dir_deg=310.0, ice_concentration_pct=68.0
        )
        t, c, conf = trajectory_service.predict_trajectory(
            "IB-042", -67.15, 76.10, p["net_speed_kts"], p["net_bearing_deg"], initial_confidence=95.0
        )
        ib_042 = IcebergDetection(
            id="IB-042",
            name="High-Hazard Tabular IB-042 [CRITICAL DRIFT INTERCEPT]",
            source_sensor="Sentinel-1 SAR Near-Real-Time Pass (Orbit 4891)",
            detected_at="2026-09-07T12:05:22Z",
            lat=-67.15,
            lon=76.10,
            length_m=760.0,
            width_m=410.0,
            estimated_height_m=31.0,
            estimated_draft_m=135.0,
            iceberg_category="Large Tabular",
            detection_confidence_pct=96.4,
            current_speed_kts=p["net_speed_kts"],
            drift_bearing_deg=p["net_bearing_deg"],
            wind_drag_kn=p["wind_drag_kn"],
            ocean_current_drag_kn=p["ocean_current_drag_kn"],
            coriolis_force_kn=p["coriolis_force_kn"],
            sea_ice_damping_pct=p["sea_ice_damping_pct"],
            predicted_trajectory=t,
            uncertainty_corridor=c,
            trajectory_confidence_pct=conf
        )
        self.icebergs["IB-042"] = ib_042
        return ib_042

    def get_all(self) -> List[IcebergDetection]:
        return list(self.icebergs.values())

    def get_by_id(self, iceberg_id: str) -> Optional[IcebergDetection]:
        return self.icebergs.get(iceberg_id)

iceberg_service = IcebergService()
