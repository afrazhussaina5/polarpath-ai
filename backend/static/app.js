// POLARPATH AI — Full-Stack Decision Support Platform
// Team: AXIOM ("THINK. BUILD. IMPACT.")
// SIH 2026 Problem Statement 26059

const { useState, useEffect, useRef, useMemo } = React;

// --- GEOGRAPHIC & BASELINE CONSTANTS ---
const BHARATI_COORDS = [-69.41, 76.19];
const INITIAL_VESSEL_COORDS = [-65.20, 75.80];

// Custom SVG Icons for Icebergs & Vessel
const createVesselIcon = (heading = 174.5) => L.divIcon({
  className: 'vessel-marker',
  html: `
    <div style="transform: rotate(${heading}deg); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 10px #38bdf8);">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="#38bdf8">
        <path d="M12 2L4 20l8-3 8 3L12 2z"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const createIcebergIcon = (isHazard = false, label = "IB") => L.divIcon({
  className: isHazard ? 'hazard-pulse' : '',
  html: `
    <div style="background: ${isHazard ? '#ef4444' : '#0284c7'}; color: white; border: 2px solid ${isHazard ? '#fee2e2' : '#bae6fd'}; border-radius: 6px; padding: 2px 6px; font-size: 10px; font-weight: 700; display: flex; align-items: center; gap: 3px; box-shadow: 0 2px 10px rgba(0,0,0,0.8); white-space: nowrap;">
      <span>${isHazard ? '⚠️' : '🧊'}</span>
      <span>${label}</span>
    </div>
  `,
  iconSize: [60, 24],
  iconAnchor: [30, 12]
});

const createStationIcon = (name) => L.divIcon({
  html: `
    <div style="background: #f59e0b; color: #071020; border: 2px solid white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; box-shadow: 0 0 14px #f59e0b;">
      ★
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

// Color scales
function getSICColor(conc) {
  if (conc < 15) return '#0369a1';  // Open water / leads
  if (conc < 35) return '#0284c7';  // Very open pack
  if (conc < 55) return '#38bdf8';  // Open pack
  if (conc < 75) return '#93c5fd';  // Close pack
  if (conc < 90) return '#e0f2fe';  // Very close pack
  return '#ffffff';                 // Consolidated / Fast ice
}

function getRiskColor(level) {
  switch (level) {
    case 'LOW': return '#10b981';
    case 'MEDIUM': return '#f59e0b';
    case 'HIGH': return '#f97316';
    case 'CRITICAL': return '#ef4444';
    default: return '#10b981';
  }
}

// --- MAIN APPLICATION COMPONENT ---
function PolarPathApp() {
  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentHorizon, setCurrentHorizon] = useState('0h');
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);

  // Core Data States
  const [seaIceData, setSeaIceData] = useState(null);
  const [icebergs, setIcebergs] = useState([]);
  const [riskCells, setRiskCells] = useState([]);
  const [riskSummary, setRiskSummary] = useState(null);
  const [routingResult, setRoutingResult] = useState(null);
  const [vesselStatus, setVesselStatus] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  
  // Explainability & Active Priority States
  const [explanation, setExplanation] = useState(null);
  const [activeExplainRouteId, setActiveExplainRouteId] = useState('ROUTE-ALPHA-BALANCED');
  const [activePriority, setActivePriority] = useState('balanced');
  const [actionNotice, setActionNotice] = useState(null);

  // UI & Simulation State
  const [isSimulatedHazard, setIsSimulatedHazard] = useState(false);
  const [selectedIceberg, setSelectedIceberg] = useState(null);
  const [loading, setLoading] = useState(true);

  // Map Layer Toggles
  const [layers, setLayers] = useState({
    seaIce: true,
    icebergs: true,
    trajectories: true,
    uncertainty: true,
    riskMap: false,
    recommendedRoute: true,
    previousRoute: true,
    alternativeRoutes: true,
    waypoints: true
  });

  // Optimization Parameter Sliders
  const [routeParams, setRouteParams] = useState({
    safetyWeight: 75,
    fuelWeight: 50,
    timeWeight: 40,
    iceClass: 'PC-5',
    vesselSpeed: 12.0
  });

  // References for Leaflet Map
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroups = useRef({
    seaIce: null,
    icebergs: null,
    trajectories: null,
    uncertainty: null,
    riskMap: null,
    routes: null,
    waypoints: null
  });

  // Show temporary action notice banner
  const triggerActionNotice = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 5000);
  };

  // 1. Fetch initial data from API
  const fetchAllData = async (horizon = currentHorizon) => {
    try {
      const [sicRes, bergsRes, riskRes, sumRes, optRes, vesRes, sysRes] = await Promise.all([
        fetch(`/api/v1/sea-ice/forecast?horizon=${horizon}`).then(r => r.json()),
        fetch('/api/v1/icebergs').then(r => r.json()),
        fetch(`/api/v1/risk-map?horizon=${horizon}`).then(r => r.json()),
        fetch(`/api/v1/risk-summary?horizon=${horizon}`).then(r => r.json()),
        fetch('/api/v1/routes/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: activePriority, vessel_speed_kts: routeParams.vesselSpeed })
        }).then(r => r.json()),
        fetch('/api/v1/vessel/status').then(r => r.json()),
        fetch('/api/v1/system/status').then(r => r.json())
      ]);

      setSeaIceData(sicRes);
      setIcebergs(bergsRes);
      setRiskCells(riskRes);
      setRiskSummary(sumRes);
      setRoutingResult(optRes);
      setVesselStatus(vesRes);
      setSystemStatus(sysRes);

      const hasIB042 = bergsRes.some(b => b.id === 'IB-042');
      setIsSimulatedHazard(hasIB042);

      if (optRes && optRes.recommended_route) {
        setActiveExplainRouteId(optRes.recommended_route.id);
        fetchExplanation(optRes.recommended_route.id);
      }

      setLoading(false);
    } catch (err) {
      console.error("API Error fetching data:", err);
      setLoading(false);
    }
  };

  const fetchExplanation = async (routeId) => {
    try {
      const idToFetch = routeId || (routingResult && routingResult.recommended_route ? routingResult.recommended_route.id : 'ROUTE-ALPHA-BALANCED');
      setActiveExplainRouteId(idToFetch);
      const res = await fetch(`/api/v1/routes/explain/${idToFetch}`).then(r => r.json());
      setExplanation(res);
    } catch (e) {
      console.error("Error fetching explanation:", e);
    }
  };

  useEffect(() => {
    fetchAllData(currentHorizon);
  }, [currentHorizon]);

  // Handle Tab Switch: Invalidate Map size when returning to Dashboard
  useEffect(() => {
    if (activeTab === 'dashboard' && mapInstance.current) {
      setTimeout(() => {
        mapInstance.current.invalidateSize();
      }, 100);
    }
    if (activeTab === 'explain') {
      const currentRouteId = routingResult && routingResult.recommended_route ? routingResult.recommended_route.id : activeExplainRouteId;
      fetchExplanation(currentRouteId);
    }
  }, [activeTab]);

  // 2. Timeline auto-play timer
  useEffect(() => {
    let interval = null;
    if (isPlayingTimeline) {
      const horizons = ['0h', '6h', '12h', '24h', '48h'];
      interval = setInterval(() => {
        setCurrentHorizon(prev => {
          const idx = horizons.indexOf(prev);
          return horizons[(idx + 1) % horizons.length];
        });
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isPlayingTimeline]);

  // 3. Initialize Leaflet Map (Runs once on mount)
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [-67.3, 76.0],
      zoom: 6,
      minZoom: 4,
      maxZoom: 10,
      zoomControl: false
    });

    // Dark nautical carto tiles with OSM fallback
   const cartoLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_33xc_1_e83fa60fc25e1af6e98b4365',
  {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO | PolarPath AI',
    subdomains: 'abcd',
    maxZoom: 20
  }
).addTo(map);

    // Zoom buttons in top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Base Vector Nautical Graticule (Parallels & Meridians) - Works 100% offline
    const graticuleGroup = L.layerGroup().addTo(map);
    [-64, -66, -68, -70].forEach(lat => {
      L.polyline([[lat, 68.0], [lat, 84.0]], {
        color: '#1e3a5f',
        weight: 1,
        dashArray: '3, 6',
        opacity: 0.5
      }).bindTooltip(`${Math.abs(lat)}°S Latitude Parallel`, { sticky: true }).addTo(graticuleGroup);
    });
    [70, 72, 74, 76, 78, 80, 82].forEach(lon => {
      L.polyline([[-63.0, lon], [-71.0, lon]], {
        color: '#1e3a5f',
        weight: 1,
        dashArray: '3, 6',
        opacity: 0.5
      }).bindTooltip(`${lon}°E Longitude Meridian`, { sticky: true }).addTo(graticuleGroup);
    });

    // High-resolution East Antarctica Coastline (Prydz Bay / Larsemann Hills / Amery Ice Shelf edge)
    const coastlineCoords = [
      [-65.5, 68.0], [-66.0, 70.0], [-66.8, 71.5], [-67.2, 72.8],
      [-68.0, 74.0], [-68.8, 75.0], [-69.45, 75.8], [-69.41, 76.19], // Bharati / Larsemann Hills
      [-69.5, 76.6], [-69.2, 77.5], [-68.6, 78.5], [-67.8, 80.0],
      [-67.0, 82.0], [-66.5, 84.0]
    ];
    L.polyline(coastlineCoords, {
      color: '#38bdf8',
      weight: 2,
      opacity: 0.85
    }).bindTooltip("East Antarctic Coastline (Prydz Bay Sector)", { sticky: true }).addTo(graticuleGroup);

    // Amery Ice Shelf Front boundary
    const ameryShelfCoords = [
      [-68.0, 71.0], [-68.5, 72.5], [-69.0, 73.5], [-69.7, 74.0]
    ];
    L.polyline(ameryShelfCoords, {
      color: '#93c5fd',
      weight: 2,
      dashArray: '4, 4',
      opacity: 0.7
    }).bindTooltip("Amery Ice Shelf Calving Front", { sticky: true }).addTo(graticuleGroup);

    // Add Station Marker for Bharati Station
    L.marker(BHARATI_COORDS, { icon: createStationIcon("Bharati") })
      .addTo(map)
      .bindPopup(`
        <div class="p-1 font-sans">
          <div class="text-xs font-bold text-amber-400">RESEARCH DESTINATION</div>
          <div class="text-sm font-extrabold text-white">Bharati Station (India)</div>
          <div class="text-xs text-slate-300 mt-1">Lat: 69°24'28"S, Lon: 76°11'14"E</div>
          <div class="text-xs text-cyan-300 mt-1">Region: Larsemann Hills, Prydz Bay</div>
        </div>
      `);

    // Create Layer Groups
    layerGroups.current.seaIce = L.layerGroup().addTo(map);
    layerGroups.current.riskMap = L.layerGroup().addTo(map);
    layerGroups.current.uncertainty = L.layerGroup().addTo(map);
    layerGroups.current.trajectories = L.layerGroup().addTo(map);
    layerGroups.current.routes = L.layerGroup().addTo(map);
    layerGroups.current.waypoints = L.layerGroup().addTo(map);
    layerGroups.current.icebergs = L.layerGroup().addTo(map);

    mapInstance.current = map;

    // Initial resize trigger
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // 4. Update Map Layers whenever data or layer toggles change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear existing layer groups
    Object.values(layerGroups.current).forEach(group => group && group.clearLayers());

    // A. SEA-ICE CONCENTRATION LAYER
    if (layers.seaIce && seaIceData && seaIceData.grid_cells) {
      seaIceData.grid_cells.forEach(cell => {
        const color = getSICColor(cell.concentration_pct);
        const bounds = [
          [cell.lat - 0.22, cell.lon - 0.35],
          [cell.lat + 0.22, cell.lon + 0.35]
        ];
        L.rectangle(bounds, {
          color: color,
          weight: 0.5,
          fillColor: color,
          fillOpacity: 0.35
        }).bindTooltip(`
          <b>Sea-Ice Concentration:</b> ${cell.concentration_pct}%<br/>
          <b>Thickness:</b> ${cell.thickness_m}m<br/>
          <b>Drift:</b> ${cell.drift_speed_kts} kts @ ${cell.drift_bearing_deg}°
        `, { sticky: true }).addTo(layerGroups.current.seaIce);
      });
    }

    // B. DYNAMIC RISK HEATMAP LAYER
    if (layers.riskMap && riskCells && riskCells.length > 0) {
      riskCells.forEach(cell => {
        const color = getRiskColor(cell.risk_level);
        const bounds = [
          [cell.lat - 0.22, cell.lon - 0.35],
          [cell.lat + 0.22, cell.lon + 0.35]
        ];
        L.rectangle(bounds, {
          color: color,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.4
        }).bindTooltip(`
          <b>Risk Level:</b> <span style="color:${color}">${cell.risk_level} (${cell.risk_score}%)</span><br/>
          <b>Primary Hazard:</b> ${cell.primary_hazard}
        `, { sticky: true }).addTo(layerGroups.current.riskMap);
      });
    }

    // C. ICEBERGS, TRAJECTORIES & UNCERTAINTY CORRIDORS
    if (icebergs && icebergs.length > 0) {
      const h_num = parseInt(currentHorizon.replace('h', '')) || 0;

      icebergs.forEach(ib => {
        const isHazard = ib.id === 'IB-042';

        let currentPos = [ib.lat, ib.lon];
        if (ib.predicted_trajectory && ib.predicted_trajectory.length > 0) {
          const pt = ib.predicted_trajectory.find(p => p.hour === h_num) || ib.predicted_trajectory[0];
          currentPos = [pt.lat, pt.lon];
        }

        // Uncertainty corridor polygon
        if (layers.uncertainty && ib.uncertainty_corridor && ib.uncertainty_corridor.polygon_coords) {
          const polyCoords = ib.uncertainty_corridor.polygon_coords.map(c => [c.lat, c.lon]);
          L.polygon(polyCoords, {
            color: isHazard ? '#ef4444' : '#0284c7',
            weight: 1.5,
            dashArray: '4, 4',
            fillColor: isHazard ? '#ef4444' : '#38bdf8',
            fillOpacity: isHazard ? 0.25 : 0.12
          }).bindTooltip(`
            <b>${ib.name}</b><br/>
            Uncertainty Corridor (+48h Dispersion Envelope)<br/>
            Confidence: ${ib.trajectory_confidence_pct}%
          `, { sticky: true }).addTo(layerGroups.current.uncertainty);
        }

        // Trajectory line
        if (layers.trajectories && ib.predicted_trajectory) {
          const trajPoints = ib.predicted_trajectory.map(p => [p.lat, p.lon]);
          L.polyline(trajPoints, {
            color: isHazard ? '#ef4444' : '#0ea5e9',
            weight: 2.5,
            dashArray: '5, 8',
            opacity: 0.9
          }).addTo(layerGroups.current.trajectories);

          // Hour dots
          ib.predicted_trajectory.forEach(pt => {
            L.circleMarker([pt.lat, pt.lon], {
              radius: 4,
              color: isHazard ? '#f87171' : '#7dd3fc',
              fillColor: isHazard ? '#ef4444' : '#0284c7',
              fillOpacity: 1
            }).bindTooltip(`+${pt.hour}h Predicted Drift: [${pt.lat.toFixed(2)}, ${pt.lon.toFixed(2)}]`).addTo(layerGroups.current.trajectories);
          });
        }

        // Iceberg Marker
        if (layers.icebergs) {
          const marker = L.marker(currentPos, {
            icon: createIcebergIcon(isHazard, ib.id)
          }).addTo(layerGroups.current.icebergs);

          marker.on('click', () => {
            setSelectedIceberg(ib);
          });

          marker.bindPopup(`
            <div class="p-1 font-sans">
              <div class="text-xs font-bold ${isHazard ? 'text-red-400' : 'text-cyan-400'}">${ib.iceberg_category.toUpperCase()}</div>
              <div class="text-sm font-bold text-white">${ib.name}</div>
              <div class="text-xs text-slate-300 mt-1">Dimensions: ${ib.length_m}m × ${ib.width_m}m (Draft: ${ib.estimated_draft_m}m)</div>
              <div class="text-xs text-slate-300">Drift: ${ib.current_speed_kts} kts @ ${ib.drift_bearing_deg}°</div>
              <div class="text-xs text-emerald-400 mt-1">Detection Confidence: ${ib.detection_confidence_pct}%</div>
              <button onclick="window.inspectIceberg('${ib.id}')" class="mt-2 w-full py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold">Inspect Physics & Drift</button>
            </div>
          `);
        }
      });
    }

    // Expose inspect function to window for leaflet popups
    window.inspectIceberg = (id) => {
      const found = icebergs.find(i => i.id === id);
      if (found) {
        setSelectedIceberg(found);
        setActiveTab('icebergs');
      }
    };

    // D. VESSEL MARKER
    if (vesselStatus) {
      const vCoords = [vesselStatus.current_lat, vesselStatus.current_lon];
      L.marker(vCoords, { icon: createVesselIcon(vesselStatus.heading_deg) })
        .addTo(layerGroups.current.routes)
        .bindPopup(`
          <div class="p-1 font-sans">
            <div class="text-xs font-bold text-cyan-400">RESEARCH VESSEL</div>
            <div class="text-sm font-bold text-white">${vesselStatus.vessel_name}</div>
            <div class="text-xs text-slate-300">Ice Class: ${vesselStatus.ice_class} | Speed: ${vesselStatus.speed_kts} kts</div>
            <div class="text-xs text-slate-300">Heading: ${vesselStatus.heading_deg}° | Fuel: ${vesselStatus.fuel_remaining_tons} tons</div>
            <div class="text-xs text-amber-400 mt-1">Destination: ${vesselStatus.destination}</div>
          </div>
        `);

      // 12 NM radar range ring
      L.circle(vCoords, {
        radius: 12 * 1852,
        color: '#38bdf8',
        weight: 1,
        dashArray: '3, 6',
        fillColor: '#38bdf8',
        fillOpacity: 0.04
      }).addTo(layerGroups.current.routes);
    }

    // E. ROUTES & WAYPOINTS
    if (routingResult) {
      // 1. Previous Compromised Route (if re-routed)
      if (layers.previousRoute && routingResult.previous_route) {
        const prev = routingResult.previous_route;
        const coords = prev.route_polyline.map(c => [c.lat, c.lon]);
        L.polyline(coords, {
          color: '#ef4444',
          weight: 3.5,
          dashArray: '8, 8',
          opacity: 0.85
        }).bindTooltip(`<b>${prev.name}</b><br/><span style="color:#ef4444">REJECTED: Intersects IB-042 drift cone!</span>`, { sticky: true }).addTo(layerGroups.current.routes);

        // Hazard intersection marker
        L.circleMarker([-67.15, 76.10], {
          radius: 10,
          color: '#ef4444',
          fillColor: '#f87171',
          fillOpacity: 0.85
        }).bindTooltip(`<b>COLLISION THREAT POINT</b><br/>IB-042 intersect @ t+14.2h`).addTo(layerGroups.current.routes);
      }

      // 2. Alternative Routes
      if (layers.alternativeRoutes && routingResult.alternative_routes) {
        routingResult.alternative_routes.forEach((alt, idx) => {
          const coords = alt.route_polyline.map(c => [c.lat, c.lon]);
          L.polyline(coords, {
            color: idx === 0 ? '#a855f7' : '#3b82f6',
            weight: 2.5,
            dashArray: '4, 6',
            opacity: 0.75
          }).bindTooltip(`<b>${alt.name}</b><br/>Dist: ${alt.total_distance_nm} NM | Risk: ${alt.risk_score}%`, { sticky: true }).addTo(layerGroups.current.routes);
        });
      }

      // 3. Recommended Route
      if (layers.recommendedRoute && routingResult.recommended_route) {
        const rec = routingResult.recommended_route;
        const coords = rec.route_polyline.map(c => [c.lat, c.lon]);
        
        // Glow effect
        L.polyline(coords, {
          color: '#06b6d4',
          weight: 9,
          opacity: 0.3
        }).addTo(layerGroups.current.routes);

        // Solid path
        L.polyline(coords, {
          color: '#38bdf8',
          weight: 4,
          opacity: 0.95
        }).bindTooltip(`<b>ACTIVE ROUTE: ${rec.name}</b><br/>ETA: ${rec.eta_hours}h | Fuel: ${rec.estimated_fuel_tons}T | Safety: ${rec.safety_score}%`, { sticky: true }).addTo(layerGroups.current.routes);

        // Waypoints
        if (layers.waypoints && rec.waypoints) {
          rec.waypoints.forEach(wp => {
            L.circleMarker([wp.lat, wp.lon], {
              radius: 5,
              color: '#38bdf8',
              fillColor: '#071020',
              fillOpacity: 1,
              weight: 2
            }).bindPopup(`
              <div class="p-1 font-sans">
                <div class="text-xs font-bold text-cyan-400">WAYPOINT: ${wp.id}</div>
                <div class="text-sm font-bold text-white">${wp.name}</div>
                <div class="text-xs text-slate-300">Lat: ${wp.lat.toFixed(2)}°, Lon: ${wp.lon.toFixed(2)}°</div>
                <div class="text-xs text-slate-300">ETA: +${wp.eta_hours} hrs</div>
                <div class="text-xs text-emerald-400">Ice Concentration: ${wp.ice_concentration_pct}%</div>
                <div class="text-xs text-amber-400">Segment Risk: ${wp.risk_level}</div>
              </div>
            `).addTo(layerGroups.current.waypoints);
          });
        }
      }
    }
  }, [layers, seaIceData, icebergs, riskCells, routingResult, vesselStatus, currentHorizon]);

  // 5. DEMO ACTION: SIMULATE NEW ICEBERG (Dynamic Re-routing Workflow)
  const handleSimulateIcebergHazard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/simulation/spawn-iceberg', { method: 'POST' }).then(r => r.json());
      
      setIsSimulatedHazard(true);
      setRoutingResult(res.routing_result);
      triggerActionNotice("⚠️ HIGH-HAZARD DETECTED: Iceberg IB-042 spawned! Route Alpha compromised (86.4% Risk). Automatically re-routed via Route Charlie (21.4% Risk).");

      const [newBergs, newRisk, newSum] = await Promise.all([
        fetch('/api/v1/icebergs').then(r => r.json()),
        fetch(`/api/v1/risk-map?horizon=${currentHorizon}`).then(r => r.json()),
        fetch(`/api/v1/risk-summary?horizon=${currentHorizon}`).then(r => r.json())
      ]);
      setIcebergs(newBergs);
      setRiskCells(newRisk);
      setRiskSummary(newSum);

      if (res.routing_result.recommended_route) {
        fetchExplanation(res.routing_result.recommended_route.id);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // 6. DEMO ACTION: RESET SIMULATION
  const handleResetSimulation = async () => {
    try {
      setLoading(true);
      await fetch('/api/v1/simulation/reset', { method: 'POST' });
      setIsSimulatedHazard(false);
      setActivePriority('balanced');
      triggerActionNotice("↺ Environment reset to nominal baseline conditions.");
      await fetchAllData(currentHorizon);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // 7. ROUTE OPTIMIZATION PRIORITY BUTTONS (Safety, Fuel, Time, Generate Safe Route)
  const handleRecalculateRoute = async (priority = 'safety') => {
    try {
      setLoading(true);
      setActivePriority(priority);

      const res = await fetch('/api/v1/routes/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: priority,
          vessel_speed_kts: routeParams.vesselSpeed,
          vessel_ice_class: routeParams.iceClass,
          weights: {
            sea_ice_weight: routeParams.safetyWeight / 100,
            iceberg_weight: routeParams.safetyWeight / 100,
            weather_weight: 0.15,
            uncertainty_weight: 0.10,
            vessel_constraint_weight: 0.10
          }
        })
      }).then(r => r.json());

      setRoutingResult(res);
      
      const newRec = res.recommended_route;
      triggerActionNotice(`✓ Route Optimizer updated to [${priority.toUpperCase()}]: Recommended path is now ${newRec.name} (${newRec.total_distance_nm} NM, Safety: ${newRec.safety_score}%)`);

      if (newRec) {
        fetchExplanation(newRec.id);
      }

      // If in planner tab, switch smoothly or let user inspect
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  // Switch to Explainability tab with specific route
  const viewRouteExplanation = (routeId) => {
    fetchExplanation(routeId);
    setActiveTab('explain');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] text-slate-100 font-sans">
      
      {/* ==================== TOP NAVIGATION BAR ==================== */}
      <header className="bg-[#071020] border-b border-[#1a2c4e] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {/* Team AXIOM Logo */}
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 via-sky-600 to-blue-800 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg shadow-cyan-900/40 border border-cyan-400/40">
            ▲
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-white text-base">AXIOM</span>
              <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                THINK. BUILD. IMPACT.
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>POLARPATH AI</span>
              <span className="text-slate-500">•</span>
              <span className="text-sky-300">Antarctic Navigation Decision Support</span>
            </div>
          </div>
        </div>

        {/* Operational & Safety Badges */}
        <div className="hidden lg:flex items-center gap-2 text-[11px]">
          <span className="bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2 py-1 rounded font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            DECISION SUPPORT SYSTEM — NOT AUTONOMOUS SHIP CONTROL
          </span>
          <span className="bg-blue-950/60 text-blue-300 border border-blue-800/60 px-2 py-1 rounded font-medium">
            SIMULATED DEMO DATASET
          </span>
          <span className="bg-slate-900 text-slate-300 border border-slate-700 px-2 py-1 rounded font-mono">
            SIH-2026 #26059
          </span>
        </div>

        {/* Interactive Scenario Trigger Buttons */}
        <div className="flex items-center gap-2">
          {!isSimulatedHazard ? (
            <button
              onClick={handleSimulateIcebergHazard}
              className="px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-md text-xs font-bold shadow-md shadow-red-950 border border-red-400/40 flex items-center gap-1.5 transition-all transform active:scale-95"
            >
              <span>⚡</span>
              <span>SIMULATE NEW ICEBERG (IB-042)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-red-400 bg-red-950/80 border border-red-800 px-2.5 py-1 rounded animate-pulse">
                ⚠️ HAZARD ACTIVE (IB-042)
              </span>
              <button
                onClick={handleResetSimulation}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-600 transition"
              >
                ↺ Reset
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ==================== TAB NAVIGATION (6-SLIDE DECK REMOVED AS REQUESTED) ==================== */}
      <nav className="bg-[#0b172d] border-b border-[#1a2c4e] px-4 flex items-center gap-1 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'dashboard', label: '🌐 Operations Dashboard', desc: 'Real-time Map & Decision Support' },
          { id: 'forecast', label: '🧊 Sea-Ice Forecast', desc: '0h-48h ConvLSTM Model' },
          { id: 'icebergs', label: '🧭 Iceberg Intelligence', desc: 'Detections & Drift Physics' },
          { id: 'planner', label: '🗺️ Route Optimizer', desc: 'Safety vs Fuel vs Time' },
          { id: 'explain', label: '💡 Explainability', desc: 'Why This Route?' },
          { id: 'telemetry', label: '📡 Data & System Status', desc: 'Pipeline Telemetry' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2.5 px-3.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Action Notification Toast Banner */}
      {actionNotice && (
        <div className="bg-cyan-950/90 border-b border-cyan-700 px-4 py-1.5 text-xs text-cyan-200 font-semibold flex items-center justify-between animate-fadeIn">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ==================== DYNAMIC RE-ROUTING BANNER ALERT ==================== */}
      {isSimulatedHazard && (
        <div className="bg-gradient-to-r from-red-950/90 via-slate-900 to-red-950/90 border-b border-red-800/80 px-4 py-2 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base animate-bounce">🚨</span>
            <div>
              <span className="font-extrabold text-red-300">DYNAMIC RE-ROUTING ACTIVE: </span>
              <span className="text-slate-200">
                Newly cataloged tabular iceberg <b>IB-042</b> predicted to cross Route Alpha at t+14.2h. 
                Automatically diverted to <b>Route Charlie (Eastern Avoidance Lead)</b>.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
              Risk: 86.4% ➔ 21.4% (▼ 65%)
            </span>
            <span className="font-mono text-cyan-300">
              Delta: +14.2 NM (+1.1 hrs)
            </span>
            <button
              onClick={() => viewRouteExplanation(routingResult && routingResult.recommended_route ? routingResult.recommended_route.id : 'ROUTE-CHARLIE-REOPTIMIZED')}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-2.5 py-1 rounded transition"
            >
              VIEW DECISION RATIONALE
            </button>
          </div>
        </div>
      )}

      {/* ==================== MAIN CONTENT BODY ==================== */}
      <main className="flex-1 flex flex-col relative">

        {/* TAB 1: OPERATIONS DASHBOARD (Kept alive in DOM with display toggle to guarantee map visibility!) */}
        <div style={{ display: activeTab === 'dashboard' ? 'flex' : 'none' }} className="flex-1 flex-col lg:flex-row min-h-[600px] h-[calc(100vh-120px)] relative">
          
          {/* LEFT / MAIN MAP AREA */}
          <div className="flex-1 flex flex-col relative h-[520px] lg:h-auto overflow-hidden">
            
            {/* Floating Map Layer Controls Header */}
            <div className="absolute top-3 left-3 z-[400] bg-[#0b172d]/90 backdrop-blur border border-[#1a2c4e] rounded-lg p-2 shadow-xl flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px] mr-1">Layers:</span>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-300">
                <input
                  type="checkbox"
                  checked={layers.seaIce}
                  onChange={e => setLayers({ ...layers, seaIce: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-0"
                />
                <span>Sea-Ice</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-300">
                <input
                  type="checkbox"
                  checked={layers.icebergs}
                  onChange={e => setLayers({ ...layers, icebergs: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-0"
                />
                <span>Icebergs</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-300">
                <input
                  type="checkbox"
                  checked={layers.trajectories}
                  onChange={e => setLayers({ ...layers, trajectories: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-0"
                />
                <span>Trajectories</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-300">
                <input
                  type="checkbox"
                  checked={layers.uncertainty}
                  onChange={e => setLayers({ ...layers, uncertainty: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-0"
                />
                <span>Uncertainty Cones</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-300">
                <input
                  type="checkbox"
                  checked={layers.riskMap}
                  onChange={e => setLayers({ ...layers, riskMap: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-0"
                />
                <span>Risk Heatmap</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-300">
                <input
                  type="checkbox"
                  checked={layers.recommendedRoute}
                  onChange={e => setLayers({ ...layers, recommendedRoute: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-0"
                />
                <span>Active Route</span>
              </label>
            </div>

            {/* Map Floating Legend */}
            <div className="absolute bottom-16 left-3 z-[400] bg-[#0b172d]/85 backdrop-blur border border-[#1a2c4e] rounded-lg p-2.5 shadow-xl text-[11px] max-w-xs pointer-events-none">
              <div className="font-bold text-slate-300 mb-1">Prydz Bay Sector (Bharati Approach)</div>
              <div className="flex items-center gap-1 text-[10px] mb-1">
                <span>Sea Ice:</span>
                <span className="w-3 h-2 bg-[#0369a1] inline-block"></span> 10%
                <span className="w-3 h-2 bg-[#0284c7] inline-block"></span> 30%
                <span className="w-3 h-2 bg-[#38bdf8] inline-block"></span> 50%
                <span className="w-3 h-2 bg-[#93c5fd] inline-block"></span> 70%
                <span className="w-3 h-2 bg-[#ffffff] inline-block"></span> 90%+
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span> Vessel</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Bharati</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500"></span> Threat Berg</span>
              </div>
            </div>

            {/* The Leaflet Map Canvas */}
            <div
              ref={mapRef}
              id="polar-map-container"
              style={{ width: '100%', height: '100%', minHeight: '520px', backgroundColor: '#050d1a' }}
              className="flex-1 w-full"
            ></div>

            {/* BOTTOM SECTION: 48-HOUR FORECAST TIMELINE SCRUBBER */}
            <div className="bg-[#071020] border-t border-[#1a2c4e] px-4 py-2.5 flex items-center justify-between gap-4 z-10">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
                  className="w-8 h-8 rounded bg-cyan-700 hover:bg-cyan-600 text-white flex items-center justify-center font-bold text-sm shadow transition"
                  title={isPlayingTimeline ? "Pause Simulation" : "Play 48-Hour Forward Drift Simulation"}
                >
                  {isPlayingTimeline ? '⏸' : '▶'}
                </button>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Forecast Timeline</div>
                  <div className="text-xs font-bold text-cyan-300 font-mono">Lead Time: {currentHorizon}</div>
                </div>
              </div>

              {/* Scrubber Buttons */}
              <div className="flex-1 max-w-xl flex items-center justify-between gap-2 px-2">
                {['0h', '6h', '12h', '24h', '48h'].map((h, i) => (
                  <button
                    key={h}
                    onClick={() => setCurrentHorizon(h)}
                    className={`flex-1 py-1 px-2 rounded font-mono text-xs transition font-semibold border ${
                      currentHorizon === h
                        ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-900/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {h === '0h' ? 'Now (0h)' : `+${h}`}
                  </button>
                ))}
              </div>

              {/* Horizon Confidence Indicator */}
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-medium text-slate-400">Prediction Confidence</div>
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {currentHorizon === '0h' && '94.2% (Very High)'}
                  {currentHorizon === '6h' && '88.5% (High)'}
                  {currentHorizon === '12h' && '81.3% (Good)'}
                  {currentHorizon === '24h' && '73.8% (Moderate)'}
                  {currentHorizon === '48h' && '63.5% (Ensemble Decay)'}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: LIVE DECISION SUPPORT */}
          <aside className="w-full lg:w-96 bg-[#071020] border-l border-[#1a2c4e] p-4 flex flex-col gap-4 overflow-y-auto">
            
            {/* 1. Vessel Status Card */}
            <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-3.5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-extrabold text-white text-sm">R/V AXIOM-01</span>
                </div>
                <span className="text-[10px] font-bold font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  POLAR CLASS PC-5
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-900/70 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">SPEED OVER GROUND</span>
                  <span className="text-white font-bold">{vesselStatus ? vesselStatus.speed_kts : 12.0} kts</span>
                </div>
                <div className="bg-slate-900/70 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">GYRO HEADING</span>
                  <span className="text-white font-bold">{vesselStatus ? vesselStatus.heading_deg : 174.5}° (S)</span>
                </div>
                <div className="bg-slate-900/70 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">FUEL ON BOARD</span>
                  <span className="text-white font-bold">420 / 850 Tons</span>
                </div>
                <div className="bg-slate-900/70 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">DESTINATION</span>
                  <span className="text-amber-400 font-bold truncate">Bharati Station</span>
                </div>
              </div>
            </div>

            {/* 2. Dynamic Risk Summary Card */}
            <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-3.5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">Dynamic Risk Assessment</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                  riskSummary && riskSummary.overall_risk_level === 'CRITICAL'
                    ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse'
                    : riskSummary && riskSummary.overall_risk_level === 'HIGH'
                    ? 'bg-orange-950 text-orange-400 border border-orange-800'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}>
                  {riskSummary ? riskSummary.overall_risk_level : 'LOW'}
                </span>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-slate-400">Composite Risk Score</span>
                  <span className="font-bold text-white">{riskSummary ? riskSummary.overall_risk_score : 24.5}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      riskSummary && riskSummary.overall_risk_score > 60
                        ? 'bg-gradient-to-r from-amber-500 to-red-500'
                        : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                    }`}
                    style={{ width: `${riskSummary ? riskSummary.overall_risk_score : 24.5}%` }}
                  ></div>
                </div>
              </div>

              {/* Sub-component risk breakdown */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Sea-Ice Compression Risk:</span>
                  <span className="font-mono font-bold text-cyan-400">{riskSummary ? riskSummary.sea_ice_risk_pct : 21.0}%</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Iceberg Drift Exposure:</span>
                  <span className="font-mono font-bold text-red-400">{riskSummary ? riskSummary.iceberg_risk_pct : 34.0}%</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Katabatic Wind Hazard:</span>
                  <span className="font-mono font-bold text-amber-400">32.0%</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Forecast Confidence:</span>
                  <span className="font-mono font-bold text-emerald-400">{riskSummary ? riskSummary.forecast_confidence_pct : 88.0}%</span>
                </div>
              </div>
            </div>

            {/* 3. Recommended Route Card */}
            {routingResult && routingResult.recommended_route && (
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-3.5 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">Navigation Decision</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    RECOMMENDED
                  </span>
                </div>

                <div className="text-sm font-extrabold text-cyan-300 mb-2">
                  {routingResult.recommended_route.name}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">TOTAL DISTANCE</span>
                    <span className="text-white font-bold">{routingResult.recommended_route.total_distance_nm} NM</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">ESTIMATED TRANSIT</span>
                    <span className="text-white font-bold">{routingResult.recommended_route.eta_hours} Hours</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">ESTIMATED FUEL</span>
                    <span className="text-white font-bold">{routingResult.recommended_route.estimated_fuel_tons} Tons</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">SAFETY SCORE</span>
                    <span className="text-emerald-400 font-bold">{routingResult.recommended_route.safety_score}%</span>
                  </div>
                </div>

                {/* Reasons Preview */}
                <div className="bg-slate-900/80 p-2 rounded text-[11px] text-slate-300 mb-3 space-y-1">
                  <div className="font-bold text-slate-200 text-[10px] uppercase">Selection Rationale:</div>
                  {routingResult.recommended_route.summary_reasons.slice(0, 2).map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-cyan-400 font-bold">✓</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>

                {/* Decision Support Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => viewRouteExplanation(routingResult.recommended_route.id)}
                    className="flex-1 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded font-bold text-xs shadow transition text-center"
                  >
                    VIEW WHY (Decision Rationale)
                  </button>
                  <button
                    onClick={() => handleRecalculateRoute('safety')}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs border border-slate-700 transition"
                    title="Recalculate with Safety Priority"
                  >
                    ↺ Safety Calc
                  </button>
                </div>
              </div>
            )}

            {/* 4. Active Catalog Quick Summary */}
            <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-3 text-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-300 uppercase text-[10px]">Tracked Icebergs</span>
                <span className="font-mono text-cyan-400 font-bold">{icebergs.length} Active</span>
              </div>
              <div className="space-y-1.5">
                {icebergs.map(ib => (
                  <div
                    key={ib.id}
                    onClick={() => {
                      setSelectedIceberg(ib);
                      setActiveTab('icebergs');
                    }}
                    className={`p-2 rounded border cursor-pointer transition flex items-center justify-between text-[11px] ${
                      ib.id === 'IB-042'
                        ? 'bg-red-950/40 border-red-800 hover:bg-red-950/70 text-red-200'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{ib.id}</span>
                      <span className="text-slate-400 ml-1 text-[10px]">({ib.iceberg_category})</span>
                    </div>
                    <span className="font-mono text-[10px] text-cyan-300">{ib.current_speed_kts} kts @ {ib.drift_bearing_deg}°</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* TAB 2: SEA-ICE FORECAST STUDIO */}
        {activeTab === 'forecast' && (
          <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1a2c4e] pb-4">
              <div>
                <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <span>🧊</span> Sea-Ice Forecasting Studio
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Predictive spatio-temporal modeling of Antarctic sea-ice concentration & thickness for research vessel navigation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 mr-2">Lead Time:</span>
                {['0h', '6h', '12h', '24h', '48h'].map(h => (
                  <button
                    key={h}
                    onClick={() => setCurrentHorizon(h)}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-bold border transition ${
                      currentHorizon === h
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-[#0b172d] text-slate-400 border-[#1a2c4e] hover:text-white'
                    }`}
                  >
                    {h === '0h' ? 'Now (0h)' : h}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Telemetry Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">MODEL ARCHITECTURE</div>
                <div className="text-xs font-bold text-cyan-300 mt-1">ConvLSTM + Temporal Attention</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Dual-stream spatial feature fusion</div>
              </div>
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">SPATIAL RESOLUTION</div>
                <div className="text-xs font-bold text-white mt-1">0.05° × 0.05° (~5.5 km)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Sentinel-1 EW SAR & AMSR2 calibrated</div>
              </div>
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">FORECAST CONFIDENCE</div>
                <div className="text-xs font-bold text-emerald-400 mt-1">
                  {seaIceData ? `${seaIceData.confidence_pct}%` : '88.5%'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Variance increases with lead horizon</div>
              </div>
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">VALIDATION STATUS</div>
                <div className="text-xs font-bold text-amber-300 mt-1">Pipeline Ready — Model Pending</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Synthetic Evaluator Active</div>
              </div>
            </div>

            {/* Regional Oceanographic Dynamics Table */}
            <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-4">
              <h3 className="text-sm font-bold text-white mb-3">Regional Sector Oceanographic Analysis (Prydz Bay / Larsemann Hills)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="pb-2">Antarctic Sub-Region</th>
                      <th className="pb-2">Current SIC (%)</th>
                      <th className="pb-2">+24h Forecast</th>
                      <th className="pb-2">+48h Forecast</th>
                      <th className="pb-2">Mean Thickness</th>
                      <th className="pb-2">Navigability Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    <tr>
                      <td className="py-2.5 font-bold">Marginal Ice Zone (64°S - 66°S)</td>
                      <td className="font-mono text-cyan-400">18.4%</td>
                      <td className="font-mono">22.1%</td>
                      <td className="font-mono">25.0%</td>
                      <td className="font-mono">0.35m</td>
                      <td><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">OPEN WATER / LEADS</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">Central Prydz Bay Channel</td>
                      <td className="font-mono text-cyan-400">42.8%</td>
                      <td className="font-mono">48.5%</td>
                      <td className="font-mono">53.2%</td>
                      <td className="font-mono">0.85m</td>
                      <td><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">NAVIGABLE (PC-5 SAFE)</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">Ingrid Christensen Coastal Flank</td>
                      <td className="font-mono text-cyan-400">32.0%</td>
                      <td className="font-mono">36.2%</td>
                      <td className="font-mono">41.0%</td>
                      <td className="font-mono">0.65m</td>
                      <td><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">COASTAL POLYNYA (PREFERRED)</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">Amery Ice Shelf Calving Margin</td>
                      <td className="font-mono text-amber-400">76.5%</td>
                      <td className="font-mono">81.0%</td>
                      <td className="font-mono">84.5%</td>
                      <td className="font-mono">1.80m</td>
                      <td><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800">HEAVY PACK / AVOID</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">Larsemann Hills Fast Ice Edge (Bharati)</td>
                      <td className="font-mono text-red-400">88.2%</td>
                      <td className="font-mono">89.5%</td>
                      <td className="font-mono">91.0%</td>
                      <td className="font-mono">2.15m</td>
                      <td><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">TERMINAL ROADSTEAD</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ICEBERG INTELLIGENCE HUB */}
        {activeTab === 'icebergs' && (
          <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1a2c4e] pb-4">
              <div>
                <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <span>🧭</span> Iceberg Intelligence & Drift Dynamics
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  SAR-based iceberg detection, physics-informed hydrodynamic trajectory forecasting, and probabilistic uncertainty corridors.
                </p>
              </div>
              <button
                onClick={handleSimulateIcebergHazard}
                className="px-3.5 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded font-bold text-xs transition"
              >
                + Spawn Hazard Iceberg (IB-042)
              </button>
            </div>

            {/* Iceberg Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {icebergs.map(ib => (
                <div
                  key={ib.id}
                  onClick={() => setSelectedIceberg(ib)}
                  className={`border rounded-lg p-3.5 cursor-pointer transition shadow-lg ${
                    selectedIceberg && selectedIceberg.id === ib.id
                      ? 'bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-400'
                      : ib.id === 'IB-042'
                      ? 'bg-red-950/30 border-red-700 hover:bg-red-950/50'
                      : 'bg-[#0b172d] border-[#1a2c4e] hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-extrabold text-white text-sm">{ib.id}</span>
                      <div className="text-[10px] text-slate-400">{ib.iceberg_category}</div>
                    </div>
                    <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                      ib.id === 'IB-042' ? 'bg-red-900 text-red-200' : 'bg-cyan-950 text-cyan-300'
                    }`}>
                      {ib.detection_confidence_pct}% DETECT
                    </span>
                  </div>

                  <div className="text-xs font-mono space-y-1 text-slate-300">
                    <div>Size: {ib.length_m}m × {ib.width_m}m</div>
                    <div>Draft: {ib.estimated_draft_m}m (Freeboard: {ib.estimated_height_m}m)</div>
                    <div>Drift: {ib.current_speed_kts} kts @ {ib.drift_bearing_deg}°</div>
                    <div className="text-[10px] text-slate-400 truncate mt-1">Sensor: {ib.source_sensor}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Iceberg Deep Dive: Physics & Trajectory */}
            {selectedIceberg && (
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-bold text-cyan-400 uppercase">PHYSICS-INFORMED DRIFT ANALYSIS</span>
                    <h2 className="text-base font-extrabold text-white">{selectedIceberg.name}</h2>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800">
                    Trajectory Confidence: {selectedIceberg.trajectory_confidence_pct}%
                  </span>
                </div>

                {/* Physics Vectors Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">SURFACE WIND DRAG</span>
                    <span className="text-white font-bold text-sm">{selectedIceberg.wind_drag_kn} kN</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Deflected 30° left (Coriolis)</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">OCEAN CURRENT DRAG</span>
                    <span className="text-white font-bold text-sm">{selectedIceberg.ocean_current_drag_kn} kN</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Deep keel hydrodynamic force</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">CORIOLIS FORCE</span>
                    <span className="text-white font-bold text-sm">{selectedIceberg.coriolis_force_kn} kN</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">f = 2Ω sin(φ) in South</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">SEA-ICE DAMPING</span>
                    <span className="text-white font-bold text-sm">{selectedIceberg.sea_ice_damping_pct}%</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Pack ice internal friction</span>
                  </div>
                </div>

                {/* Predicted Waypoints Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2">Forward Trajectory Waypoints & Uncertainty Radius</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                          <th className="pb-1.5">Horizon</th>
                          <th className="pb-1.5">Predicted Lat</th>
                          <th className="pb-1.5">Predicted Lon</th>
                          <th className="pb-1.5">Drift Speed</th>
                          <th className="pb-1.5">Bearing</th>
                          <th className="pb-1.5">Uncertainty Radius (σ)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {selectedIceberg.predicted_trajectory.map(pt => (
                          <tr key={pt.hour}>
                            <td className="py-2 font-bold text-cyan-400">+{pt.hour} Hours</td>
                            <td>{pt.lat.toFixed(4)}°S</td>
                            <td>{pt.lon.toFixed(4)}°E</td>
                            <td>{pt.speed_kts} kts</td>
                            <td>{pt.bearing_deg}°</td>
                            <td className="text-amber-400 font-bold">± {pt.uncertainty_radius_km} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ROUTE PLANNER & OPTIMIZER (WITH WORKING PRESETS & GENERATE BUTTON!) */}
        {activeTab === 'planner' && (
          <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1a2c4e] pb-4">
              <div>
                <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <span>🗺️</span> Multi-Objective Polar Route Optimization
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Pareto-optimal pathfinding balancing safety hazard penalties, hull ice resistance fuel burn, and mission schedule.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Active Priority:</span>
                <span className="text-xs font-bold font-mono px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 uppercase">
                  {activePriority}
                </span>
              </div>
            </div>

            {/* Input Configuration & Preference Sliders */}
            <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-5">
              <h3 className="text-sm font-bold text-white mb-4">Mission Routing Parameters & Priority Presets</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Weight Sliders */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-mono">
                      <span>Safety Priority Weight:</span>
                      <span className="text-cyan-400 font-bold">{routeParams.safetyWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={routeParams.safetyWeight}
                      onChange={e => setRouteParams({ ...routeParams, safetyWeight: parseInt(e.target.value) })}
                      className="w-full accent-cyan-500"
                    />
                    <span className="text-[10px] text-slate-400 block">Penalizes proximity to icebergs and compressive pack ice</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1 font-mono">
                      <span>Fuel Economy Weight:</span>
                      <span className="text-cyan-400 font-bold">{routeParams.fuelWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={routeParams.fuelWeight}
                      onChange={e => setRouteParams({ ...routeParams, fuelWeight: parseInt(e.target.value) })}
                      className="w-full accent-cyan-500"
                    />
                    <span className="text-[10px] text-slate-400 block">Avoids thick ice breaking and ramming resistance</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1 font-mono">
                      <span>Transit Speed Weight:</span>
                      <span className="text-cyan-400 font-bold">{routeParams.timeWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={routeParams.timeWeight}
                      onChange={e => setRouteParams({ ...routeParams, timeWeight: parseInt(e.target.value) })}
                      className="w-full accent-cyan-500"
                    />
                    <span className="text-[10px] text-slate-400 block">Prefers direct rhumb-line paths when safe</span>
                  </div>
                </div>

                {/* Vessel Parameters */}
                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 uppercase">Vessel Polar Class</label>
                    <select
                      value={routeParams.iceClass}
                      onChange={e => setRouteParams({ ...routeParams, iceClass: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                    >
                      <option value="PC-1">PC-1: Year-round all polar waters</option>
                      <option value="PC-3">PC-3: Year-round second-year ice</option>
                      <option value="PC-5">PC-5: Year-round medium first-year ice (R/V AXIOM-01)</option>
                      <option value="PC-7">PC-7: Summer/Autumn thin first-year ice</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 uppercase">Cruise Speed (Knots)</label>
                    <input
                      type="number"
                      min="6"
                      max="16"
                      step="0.5"
                      value={routeParams.vesselSpeed}
                      onChange={e => setRouteParams({ ...routeParams, vesselSpeed: parseFloat(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 uppercase">Destination</label>
                    <input
                      type="text"
                      disabled
                      value="Bharati Research Station (-69.41°S, 76.19°E)"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-amber-400 font-bold"
                    />
                  </div>
                </div>

                {/* Priority Presets & Working Generate Button */}
                <div className="flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Select Optimization Priority:</span>
                    
                    <button
                      onClick={() => handleRecalculateRoute('safety')}
                      className={`w-full py-2 px-3 rounded text-xs font-bold transition flex items-center justify-between border ${
                        activePriority === 'safety'
                          ? 'bg-emerald-800 text-white border-emerald-400 shadow-md shadow-emerald-950 ring-1 ring-emerald-400'
                          : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-700'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">🛡️ SAFETY FIRST</span>
                      <span className="text-[10px] font-mono">Max Standoff</span>
                    </button>

                    <button
                      onClick={() => handleRecalculateRoute('fuel')}
                      className={`w-full py-2 px-3 rounded text-xs font-bold transition flex items-center justify-between border ${
                        activePriority === 'fuel'
                          ? 'bg-blue-800 text-white border-blue-400 shadow-md shadow-blue-950 ring-1 ring-blue-400'
                          : 'bg-blue-950/80 hover:bg-blue-900 text-blue-300 border-blue-700'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">⛽ FUEL EFFICIENT</span>
                      <span className="text-[10px] font-mono">Polynya Leads</span>
                    </button>

                    <button
                      onClick={() => handleRecalculateRoute('time')}
                      className={`w-full py-2 px-3 rounded text-xs font-bold transition flex items-center justify-between border ${
                        activePriority === 'time'
                          ? 'bg-purple-800 text-white border-purple-400 shadow-md shadow-purple-950 ring-1 ring-purple-400'
                          : 'bg-purple-950/80 hover:bg-purple-900 text-purple-300 border-purple-700'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">⚡ FASTEST SAFE</span>
                      <span className="text-[10px] font-mono">Direct Rhumb</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleRecalculateRoute(activePriority)}
                    className="w-full py-3 mt-4 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded font-bold text-xs shadow-lg shadow-cyan-900/40 uppercase tracking-wider transition active:scale-95"
                  >
                    GENERATE SAFE ROUTE
                  </button>
                </div>
              </div>
            </div>

            {/* Side-by-Side 3-Route Comparison Table */}
            {routingResult && (
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-white">Multi-Route Evaluation & Trade-off Matrix</h3>
                  <span className="text-xs text-cyan-300 font-mono">Recommended: <b>{routingResult.recommended_route.name}</b></span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                        <th className="pb-2.5">Route Option</th>
                        <th className="pb-2.5">Type</th>
                        <th className="pb-2.5">Distance</th>
                        <th className="pb-2.5">ETA</th>
                        <th className="pb-2.5">Fuel Burn</th>
                        <th className="pb-2.5">Risk Score</th>
                        <th className="pb-2.5">Safety Score</th>
                        <th className="pb-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                      {/* Recommended */}
                      <tr className="bg-cyan-950/30">
                        <td className="py-3 font-bold text-cyan-300 font-sans">{routingResult.recommended_route.name}</td>
                        <td><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">RECOMMENDED</span></td>
                        <td>{routingResult.recommended_route.total_distance_nm} NM</td>
                        <td>{routingResult.recommended_route.eta_hours} hrs</td>
                        <td>{routingResult.recommended_route.estimated_fuel_tons} T</td>
                        <td className="text-emerald-400 font-bold">{routingResult.recommended_route.risk_score}%</td>
                        <td className="text-emerald-400 font-bold">{routingResult.recommended_route.safety_score}%</td>
                        <td>
                          <button
                            onClick={() => viewRouteExplanation(routingResult.recommended_route.id)}
                            className="px-2 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-[10px] font-sans font-bold"
                          >
                            View Why
                          </button>
                        </td>
                      </tr>

                      {/* Alternatives */}
                      {routingResult.alternative_routes.map((alt, i) => (
                        <tr key={i}>
                          <td className="py-3 font-sans text-slate-300">{alt.name}</td>
                          <td><span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">ALTERNATIVE</span></td>
                          <td>{alt.total_distance_nm} NM</td>
                          <td>{alt.eta_hours} hrs</td>
                          <td>{alt.estimated_fuel_tons} T</td>
                          <td>{alt.risk_score}%</td>
                          <td>{alt.safety_score}%</td>
                          <td>
                            <button
                              onClick={() => viewRouteExplanation(alt.id)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-sans"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Previous Compromised Route if active */}
                      {routingResult.previous_route && (
                        <tr className="bg-red-950/30">
                          <td className="py-3 font-sans text-red-300 font-bold">{routingResult.previous_route.name}</td>
                          <td><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">COMPROMISED</span></td>
                          <td>{routingResult.previous_route.total_distance_nm} NM</td>
                          <td>{routingResult.previous_route.eta_hours} hrs</td>
                          <td>{routingResult.previous_route.estimated_fuel_tons} T</td>
                          <td className="text-red-400 font-bold">{routingResult.previous_route.risk_score}%</td>
                          <td className="text-red-400 font-bold">{routingResult.previous_route.safety_score}%</td>
                          <td>
                            <button
                              onClick={() => viewRouteExplanation(routingResult.previous_route.id)}
                              className="px-2 py-1 bg-red-900 hover:bg-red-800 text-red-200 rounded text-[10px] font-sans font-bold"
                            >
                              Why Rejected
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: EXPLAINABILITY ("VIEW WHY") (WITH DEDICATED ROUTE SELECTORS AND INSTANT RATIONALE!) */}
        {activeTab === 'explain' && (
          <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1a2c4e] pb-4">
              <div>
                <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <span>💡</span> Explainable AI Navigation Rationale
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Transparent decision attribution explaining why the recommended route was selected and why alternatives were rejected.
                </p>
              </div>

              {/* Route Selector Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-slate-400 mr-1">Inspect Route:</span>
                <button
                  onClick={() => fetchExplanation('ROUTE-ALPHA-BALANCED')}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition border ${
                    activeExplainRouteId.includes('ALPHA')
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  Route Alpha (Direct)
                </button>
                <button
                  onClick={() => fetchExplanation('ROUTE-BETA-SAFETY')}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition border ${
                    activeExplainRouteId.includes('BETA')
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  Route Beta (Safety First)
                </button>
                <button
                  onClick={() => fetchExplanation('ROUTE-GAMMA-SPEED')}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition border ${
                    activeExplainRouteId.includes('GAMMA')
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  Route Gamma (Fastest)
                </button>
                {isSimulatedHazard && (
                  <button
                    onClick={() => fetchExplanation('ROUTE-CHARLIE-REOPTIMIZED')}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition border ${
                      activeExplainRouteId.includes('CHARLIE')
                        ? 'bg-red-600 text-white border-red-400'
                        : 'bg-red-950 text-red-300 border-red-700 hover:border-red-500'
                    }`}
                  >
                    Route Charlie (Re-Route)
                  </button>
                )}
              </div>
            </div>

            {/* Currently Active Explanation Banner */}
            <div className="bg-[#0b172d] border border-cyan-800/80 rounded-lg p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan-400 uppercase">ACTIVE EVALUATION:</span>
                <span className="font-extrabold text-white text-sm">
                  {explanation ? explanation.route_name : activeExplainRouteId}
                </span>
              </div>
              <span className="font-mono text-emerald-400 font-bold bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
                STATUS: {explanation ? explanation.recommendation_status : 'READY'}
              </span>
            </div>

            {/* Why This Route Was Selected */}
            <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span> DECISION SELECTION RATIONALE
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {explanation && explanation.primary_rationale ? (
                  explanation.primary_rationale.map((reason, idx) => (
                    <div key={idx} className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800 flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed">{reason}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 col-span-2 py-4 text-center">Loading decision rationale...</div>
                )}
              </div>
            </div>

            {/* Hazard Standoff & Avoidance Metrics */}
            {explanation && explanation.hazard_avoidance_details && explanation.hazard_avoidance_details.length > 0 && (
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-5">
                <h3 className="text-sm font-bold text-white mb-3">Hazard Standoff & Clearance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {explanation.hazard_avoidance_details.map((h, i) => (
                    <div key={i} className="bg-slate-900/80 p-3.5 rounded border border-slate-800 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between items-center font-sans">
                        <span className="font-bold text-white">{h.hazard_name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                          {h.threat_level}
                        </span>
                      </div>
                      <div className="text-slate-300">Closest Point of Approach (CPA): <b className="text-cyan-400">{h.closest_point_of_approach_nm} NM</b></div>
                      <div className="text-slate-300">Time to Closest Approach: <b className="text-cyan-400">+{h.time_to_closest_point_hrs} hrs</b></div>
                      <div className="text-[11px] text-emerald-400 font-sans mt-1">Action: {h.mitigation_action}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Why Alternatives Were Rejected */}
            {explanation && explanation.alternative_comparisons && explanation.alternative_comparisons.length > 0 && (
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <span className="text-red-400 font-bold">✗</span> REJECTION ANALYSIS FOR ALTERNATIVE TRACKS
                </h3>
                <div className="space-y-3">
                  {explanation.alternative_comparisons.map((alt, i) => (
                    <div key={i} className="bg-slate-900/70 p-3.5 rounded border border-slate-800">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-white text-xs">{alt.route_name}</span>
                        <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950 px-2 py-0.5 rounded border border-red-800">
                          {alt.evaluation}
                        </span>
                      </div>
                      <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                        {alt.rejection_reasons.map((r, ri) => (
                          <li key={ri}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* IMO Polar Code Compliance Assessment */}
            {explanation && explanation.polar_code_assessment && (
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-5">
                <h3 className="text-sm font-bold text-white mb-2">IMO Polar Code & POLARIS Risk Index Outcome</h3>
                <p className="text-xs text-slate-300 mb-4">
                  Evaluation under the Polar Operational Limit Assessment Risk Indexing System (IMO MSC.1/Circ.1519). A positive RIO (≥ 0) authorizes normal independent navigation for the vessel's ice class.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">VESSEL ICE CLASS</span>
                    <span className="text-white font-bold">{explanation.polar_code_assessment.vessel_ice_class}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">POLARIS RIO SCORE</span>
                    <span className="text-emerald-400 font-bold">{explanation.polar_code_assessment.polaris_rio_score}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">ICEBREAKER ESCORT</span>
                    <span className="text-white font-bold">{explanation.polar_code_assessment.icebreaker_escort_required ? 'MANDATORY' : 'NOT REQUIRED'}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">MAX SAFE SPEED</span>
                    <span className="text-cyan-400 font-bold">{explanation.polar_code_assessment.max_safe_transit_speed_kts} kts</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: DATA & SYSTEM TELEMETRY (AI/ML MODULE STATES 1-6 REMOVED AS REQUESTED) */}
        {activeTab === 'telemetry' && (
          <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1a2c4e] pb-4">
              <div>
                <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <span>📡</span> Multi-Source Ingestion & Platform Telemetry
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Earth observation feeds, sensor update latencies, and operational decision-support parameters.
                </p>
              </div>
            </div>

            {/* Ingestion Data Sources */}
            <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-5">
              <h3 className="text-sm font-bold text-white mb-3">Earth Observation & Ingestion Data Sources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemStatus && systemStatus.data_sources.map((src, i) => (
                  <div key={i} className="bg-slate-900/80 p-3.5 rounded border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white">{src.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-blue-950 text-blue-300 border border-blue-800">
                        {src.mode}
                      </span>
                    </div>
                    <div className="text-[11px] text-cyan-400 font-mono">{src.category}</div>
                    <p className="text-slate-300 text-[11px]">{src.details}</p>
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
                      <span>Status: <b className="text-emerald-400">{src.status}</b></span>
                      <span>Latency: {src.latency_seconds}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Components & Health */}
            {systemStatus && systemStatus.system_components && systemStatus.system_components.length > 0 && (
              <div className="bg-[#0b172d] border border-[#1a2c4e] rounded-lg p-5">
                <h3 className="text-sm font-bold text-white mb-3">Core Platform Components & Subsystems</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {systemStatus.system_components.map((comp, i) => (
                    <div key={i} className="bg-slate-900/80 p-3.5 rounded border border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-white text-xs">{comp.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {comp.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-cyan-400 font-mono">{comp.category}</div>
                      <p className="text-slate-300 text-[11px]">{comp.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ethical AI & Operational Notice */}
            <div className="bg-[#071020] border border-amber-800/80 rounded-lg p-4 text-xs space-y-2">
              <div className="font-bold text-amber-400 flex items-center gap-1.5 uppercase text-[11px]">
                <span>⚠️</span> Professional Decision Support Mandate
              </div>
              <p className="text-slate-300 leading-relaxed">
                PolarPath AI is strictly an AI-assisted decision-support platform designed for qualified ice navigators and Antarctic mission planners (NCPOR, BAS, AWI). It does NOT perform autonomous steering or override human master commands. All satellite layers and meteorological forcings in this prototype are generated via high-fidelity synthetic Antarctic models clearly marked for hackathon evaluation.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-[#071020] border-t border-[#1a2c4e] px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">POLARPATH AI v1.0</span>
          <span>•</span>
          <span>Developed by Team <b className="text-cyan-300">AXIOM</b> for Smart India Hackathon 2026 (Problem Statement 26059)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Backend Online</span>
          <span>FastAPI :8000</span>
          <span>Prydz Bay Sector (Bharati Approach)</span>
        </div>
      </footer>
    </div>
  );
}

// Render React App to DOM
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<PolarPathApp />);
}
