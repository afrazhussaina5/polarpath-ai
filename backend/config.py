import os

# Geographic Bounds: Prydz Bay / Bharati Station Approach (East Antarctica)
# Lat: -64.0° to -70.5° S, Lon: 70.0° to 82.0° E
BOUNDS = {
    "min_lat": -70.5,
    "max_lat": -64.0,
    "min_lon": 70.0,
    "max_lon": 82.0
}

# Key Stations
STATIONS = {
    "bharati": {
        "name": "Bharati Research Station (India)",
        "lat": -69.41,
        "lon": 76.19,
        "region": "Larsemann Hills, Prydz Bay",
        "opened": 2012,
        "ice_conditions": "Seasonal fast ice and coastal pack ice"
    },
    "maitri": {
        "name": "Maitri Research Station (India)",
        "lat": -70.77,
        "lon": 11.73,
        "region": "Schirmacher Oasis, Queen Maud Land",
        "opened": 1989,
        "ice_conditions": "Inland ice sheet, shelf access via Nivlisen"
    },
    "mcmurdo": {
        "name": "McMurdo Station (US)",
        "lat": -77.85,
        "lon": 166.67,
        "region": "Ross Island",
        "opened": 1956,
        "ice_conditions": "Heavy multi-year fast ice"
    }
}

# Default Research Vessel
DEFAULT_VESSEL = {
    "vessel_name": "R/V AXIOM-01",
    "callsign": "VUAK",
    "imo_number": "9842109",
    "ice_class": "PC-5",  # Year-round operation in medium first-year ice
    "length_overall_m": 128.5,
    "beam_m": 24.0,
    "draft_m": 8.2,
    "displacement_tons": 12800,
    "fuel_capacity_tons": 850.0,
    "fuel_remaining_tons": 420.0,
    "cruise_speed_kts": 12.0,
    "max_speed_kts": 15.5,
    "icebreaking_speed_kts": 4.5,
    "polar_code_category": "Category B"
}

# AI Model Configuration
MODEL_METADATA = {
    "sea_ice_forecasting": {
        "architecture": "Spatio-Temporal ConvLSTM + Self-Attention Ensemble",
        "lead_times": ["0h", "6h", "12h", "24h", "48h"],
        "resolution": "0.05° x 0.05° (~5.5 km)",
        "input_features": ["AMSR2_SIC", "Sentinel-1_SAR", "ERA5_Wind_10m", "HYCOM_Currents", "OSTIA_SST"],
        "status": "READY (Synthetic Evaluator Active)",
        "validation_metric": "Pipeline ready — model validation pending"
    },
    "iceberg_detection": {
        "architecture": "YOLOv8-PolarSAR (Synthetic Aperture Radar dual-pol CFAR baseline)",
        "sensors": ["Sentinel-1A/B C-band SAR", "Sentinel-2 MSI", "MODIS NIR"],
        "min_detection_length_m": 80.0,
        "status": "READY (Synthetic SAR Catalog)",
        "validation_metric": "Pipeline ready — model validation pending"
    },
    "iceberg_trajectory": {
        "architecture": "Physics-Informed Neural Network (PINN) + Ocean Drift Hydrodynamic Model",
        "drift_forces": ["Surface Wind Drag", "Deep Ocean Current Drag", "Coriolis Force", "Sea-Ice Internal Stress"],
        "uncertainty_formulation": "Empirical Covariance Cone (sigma ~ sqrt(t))",
        "status": "READY",
        "validation_metric": "Pipeline ready — validation pending"
    },
    "risk_engine": {
        "architecture": "Dynamic Multimodal Hazard Aggregator & Cost Surface Generator",
        "status": "ACTIVE",
        "validation_metric": "Deterministic Cost Field Ready"
    },
    "route_optimizer": {
        "architecture": "Multi-Objective Constrained A* / D* Lite Grid Pathfinder",
        "status": "READY",
        "validation_metric": "Operational"
    }
}
