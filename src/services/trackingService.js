const db = require('../../database/db');

// Realistic predefined transit waypoints in Central/South Jakarta
const ROUTE_SUDIRMAN = [
  { lat: -6.1754, lon: 106.8272 }, // Monas
  { lat: -6.1870, lon: 106.8235 }, // Sarinah Thamrin
  { lat: -6.1950, lon: 106.8230 }, // Bundaran HI
  { lat: -6.2088, lon: 106.8229 }, // Dukuh Atas Sudirman
  { lat: -6.2200, lon: 106.8120 }, // Semanggi
  { lat: -6.2270, lon: 106.8080 }, // Senayan GBK
  { lat: -6.2440, lon: 106.7990 }  // Blok M
];

const ROUTE_KUNINGAN = [
  { lat: -6.1950, lon: 106.8370 }, // Menteng / Manggarai
  { lat: -6.2155, lon: 106.8315 }, // Rasuna Said Kuningan
  { lat: -6.2280, lon: 106.8290 }, // Kuningan City / Satrio
  { lat: -6.2420, lon: 106.8320 }  // Mampang Prapatan
];

// Community/demo rider is privacy-aware (see applyPrivacy)
const DEMO_RIDER_ID = 'usr-demo-001';

const simulatedVehicles = [
  { id: 'veh-tj-01', name: 'TransJakarta Koridor 1', type: 'bus', icon: '🚌', route: ROUTE_SUDIRMAN, currentIndex: 0, progress: 0.1, speedKmh: 35, status: 'In Service' },
  { id: 'veh-tj-02', name: 'TransJakarta Rute 6B', type: 'bus', icon: '🚌', route: ROUTE_KUNINGAN, currentIndex: 1, progress: 0.6, speedKmh: 28, status: 'In Service' },
  { id: 'veh-pol-01', name: 'Patroli Korlantas 01', type: 'police', icon: '🚓', route: ROUTE_SUDIRMAN, currentIndex: 3, progress: 0.4, speedKmh: 45, status: 'On Duty' },
  { id: 'veh-amb-01', name: 'Ambulans Darurat 119', type: 'ambulance', icon: '🚑', route: ROUTE_KUNINGAN, currentIndex: 2, progress: 0.8, speedKmh: 55, status: 'Responding' },
  { id: 'veh-mot-01', name: 'NEX_Rider (Anda)', type: 'motorcycle', icon: '🏍️', route: ROUTE_SUDIRMAN, currentIndex: 4, progress: 0.2, speedKmh: 40, status: 'Active Trip', privacyAware: true, userId: DEMO_RIDER_ID },
  { id: 'veh-car-01', name: 'Taxi_Blue_Express', type: 'car', icon: '🚖', route: ROUTE_SUDIRMAN, currentIndex: 2, progress: 0.7, speedKmh: 32, status: 'Carrying Passenger' },
  { id: 'veh-trk-01', name: 'Logistik Nusantara Truk', type: 'truck', icon: '🚛', route: ROUTE_KUNINGAN, currentIndex: 0, progress: 0.3, speedKmh: 25, status: 'Cargo In Transit' }
];

function interpolate(p1, p2, t) {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * t,
    lon: p1.lon + (p2.lon - p1.lon) * t
  };
}

function calculateHeading(p1, p2) {
  const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/**
 * UU PDP privacy: the opted-in community rider is hidden in ghost mode and
 * fuzzily masked while inside their private home zone.
 */
function applyPrivacy(vehicle) {
  if (!vehicle.privacyAware || !vehicle.userId) return vehicle;

  const user = db.get('SELECT privacy_mode, fuzzy_radius_meters, home_lat, home_lon FROM users WHERE id = ?', [vehicle.userId]);
  if (!user) return vehicle;

  if (user.privacy_mode === 'ghost') return null;

  if (user.home_lat != null && user.home_lon != null) {
    const d = db.haversineDistanceMeters(vehicle.lat, vehicle.lon, user.home_lat, user.home_lon);
    if (d <= (user.fuzzy_radius_meters || 300)) {
      vehicle = {
        ...vehicle,
        lat: Number((vehicle.lat + (Math.random() - 0.5) * 0.004).toFixed(4)),
        lon: Number((vehicle.lon + (Math.random() - 0.5) * 0.004).toFixed(4)),
        privacyMasked: true
      };
    }
  }
  return vehicle;
}

function snapshot(v) {
  const p1 = v.route[v.currentIndex];
  const p2 = v.route[v.currentIndex + 1];
  const pos = interpolate(p1, p2, v.progress);
  const base = {
    id: v.id,
    name: v.name,
    type: v.type,
    icon: v.icon,
    lat: Number(pos.lat.toFixed(6)),
    lon: Number(pos.lon.toFixed(6)),
    speedKmh: v.speedKmh,
    heading: Math.round(calculateHeading(p1, p2)),
    status: v.status
  };
  return applyPrivacy({ ...base, privacyAware: v.privacyAware, userId: v.userId });
}

const TrackingService = {
  /**
   * Tick simulated vehicles positions
   */
  tick() {
    for (const v of simulatedVehicles) {
      v.progress += 0.04;
      if (v.progress >= 1.0) {
        v.progress = 0;
        v.currentIndex = (v.currentIndex + 1) % (v.route.length - 1);
      }
    }
    return this.getLiveVehicles();
  },

  /**
   * Get all live vehicles (privacy-filtered)
   */
  getLiveVehicles() {
    return simulatedVehicles.map(snapshot).filter(Boolean);
  },

  /**
   * Generate a route with congestion segments and incident-aware ETA.
   */
  generateNavigationRoute(fromLat, fromLon, toLat, toLon) {
    const TrafficService = require('./trafficService');
    const totalDistMeters = db.haversineDistanceMeters(fromLat, fromLon, toLat, toLon);
    const totalDistKm = Number((totalDistMeters / 1000).toFixed(1));

    const summary = TrafficService.getSummary();
    const midLat = (fromLat + toLat) / 2;
    const midLon = (fromLon + toLon) / 2;
    const incidentPenalty = TrafficService.getIncidentPenalty(midLat, midLon, 1200);

    // Effective speed from live network speed, reduced by incidents
    const effectiveSpeed = Math.max(8, summary.avgSpeed * (1 - incidentPenalty));
    const etaMins = Math.max(3, Math.round((totalDistKm / effectiveSpeed) * 60));

    const stepsCount = 6;
    const waypoints = [];
    for (let i = 0; i <= stepsCount; i++) {
      const t = i / stepsCount;
      const baseLat = fromLat + (toLat - fromLat) * t;
      const baseLon = fromLon + (toLon - fromLon) * t;
      const jitterLat = i > 0 && i < stepsCount ? Math.sin(i * 1.5) * 0.001 : 0;
      const jitterLon = i > 0 && i < stepsCount ? Math.cos(i * 1.5) * 0.001 : 0;
      waypoints.push([Number((baseLat + jitterLat).toFixed(6)), Number((baseLon + jitterLon).toFixed(6))]);
    }

    const palette = ['#22c55e', '#eab308', '#f97316', '#ef4444'];
    const segments = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const idx = (i % 2 === 0) ? 0 : (i % 3 === 0 ? 2 : 1);
      segments.push({
        from: waypoints[i],
        to: waypoints[i + 1],
        color: palette[idx],
        status: idx === 0 ? 'Lancar' : idx === 1 ? 'Mulai Padat' : 'Padat'
      });
    }

    const maneuvers = [
      { step: 1, instruction: 'Mulai perjalanan ke arah selatan', distance: '300 m' },
      { step: 2, instruction: 'Belok kiri ke jalan utama', distance: '1.2 km' },
      { step: 3, instruction: 'Tetap di 2 lajur kanan melewati flyover', distance: '2.5 km' },
      { step: 4, instruction: 'Ambil jalan keluar menuju bundaran', distance: '800 m' },
      { step: 5, instruction: 'Tiba di destinasi tujuan di sebelah kiri', distance: '100 m' }
    ];

    return {
      distanceKm: totalDistKm,
      etaMins,
      effectiveSpeedKmh: Math.round(effectiveSpeed * 10) / 10,
      congestionLabel: summary.label,
      incidentPenalty: Math.round(incidentPenalty * 100) / 100,
      waypoints,
      segments,
      maneuvers
    };
  }
};

module.exports = TrackingService;
