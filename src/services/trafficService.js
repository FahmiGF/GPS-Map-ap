const db = require('../../database/db');

/**
 * Traffic density simulation for the map "Traffic" layer.
 * Speeds perform a bounded random walk around a per-road baseline,
 * then the ACI converts speed into the official NEXMAP color system.
 */
const SEGMENT_SEEDS = [
  { id: 'seg-sudirman-1', road: 'Jl. Jend. Sudirman (Dukuh Atas)', a: [-6.2005, 106.8229], b: [-6.2088, 106.8229], base: 26, free: 50 },
  { id: 'seg-sudirman-2', road: 'Jl. Jend. Sudirman (Semanggi)', a: [-6.2088, 106.8229], b: [-6.2200, 106.8120], base: 20, free: 50 },
  { id: 'seg-thamrin-1', road: 'Jl. M.H. Thamrin (Bundaran HI)', a: [-6.1950, 106.8230], b: [-6.1870, 106.8235], base: 30, free: 50 },
  { id: 'seg-gatsu-1', road: 'Jl. Gatot Subroto', a: [-6.2250, 106.8090], b: [-6.2350, 106.8120], base: 34, free: 60 },
  { id: 'seg-rasuna-1', road: 'Jl. H.R. Rasuna Said', a: [-6.2155, 106.8315], b: [-6.2280, 106.8290], base: 15, free: 50 },
  { id: 'seg-casablanca-1', road: 'Jl. Casablanca', a: [-6.2240, 106.8350], b: [-6.2350, 106.8420], base: 22, free: 50 },
  { id: 'seg-tol-1', road: 'Tol Dalam Kota (Cawang)', a: [-6.2420, 106.8620], b: [-6.2500, 106.8800], base: 48, free: 80 }
];

function seedSegments() {
  const count = db.get('SELECT COUNT(*) AS c FROM traffic_segments').c;
  if (count > 0) return;
  for (const s of SEGMENT_SEEDS) {
    db.run(
      `INSERT INTO traffic_segments (
        id, road_name, start_lat, start_lon, end_lat, end_lon, speed_kmh, free_flow_kmh, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.road, s.a[0], s.a[1], s.b[0], s.b[1], s.base, s.free, Date.now()]
    );
  }
}

const TrafficService = {
  seedSegments,

  /**
   * Advance each segment's speed with a bounded random walk.
   */
  tick() {
    seedSegments();
    const rows = db.all('SELECT * FROM traffic_segments');
    const now = Date.now();

    for (const r of rows) {
      const delta = (Math.random() - 0.5) * 6; // ±3 km/h per tick
      const next = Math.max(4, Math.min(r.free_flow_kmh, r.speed_kmh + delta));
      db.run('UPDATE traffic_segments SET speed_kmh = ?, updated_at = ? WHERE id = ?', [
        Math.round(next * 10) / 10,
        now,
        r.id
      ]);
    }
    return this.getSegments();
  },

  getSegments() {
    seedSegments();
    return db.all('SELECT * FROM traffic_segments').map(s => {
      const aci = s.free_flow_kmh > 0 ? Math.min(1, s.speed_kmh / s.free_flow_kmh) : 1;
      let label, color;
      if (aci < 0.2) {
        label = 'Macet Total (Gridlock)';
        color = '#7f1d1d';
      } else if (aci < 0.4) {
        label = 'Macet';
        color = '#ef4444';
      } else if (aci < 0.6) {
        label = 'Padat';
        color = '#f97316';
      } else if (aci < 0.85) {
        label = 'Mulai Padat';
        color = '#eab308';
      } else {
        label = 'Lancar';
        color = '#22c55e';
      }

      return {
        id: s.id,
        roadName: s.road_name,
        start: [s.start_lat, s.start_lon],
        end: [s.end_lat, s.end_lon],
        speedKmh: s.speed_kmh,
        freeFlowKmh: s.free_flow_kmh,
        aci: Math.round(aci * 100) / 100,
        label,
        color,
        updatedAt: s.updated_at
      };
    });
  },

  /**
   * Network-wide summary used by the ACI gauge.
   */
  getSummary() {
    const segments = this.getSegments();
    if (segments.length === 0) {
      return { avgSpeed: 0, avgAci: 1, label: 'Lancar', color: '#22c55e', segments: 0 };
    }
    const avgSpeed = segments.reduce((sum, s) => sum + s.speedKmh, 0) / segments.length;
    const avgAci = segments.reduce((sum, s) => sum + s.aci, 0) / segments.length;

    let label = 'Lancar';
    let color = '#22c55e';
    if (avgAci < 0.2) {
      label = 'Macet Total';
      color = '#7f1d1d';
    } else if (avgAci < 0.4) {
      label = 'Macet';
      color = '#ef4444';
    } else if (avgAci < 0.6) {
      label = 'Padat';
      color = '#f97316';
    } else if (avgAci < 0.85) {
      label = 'Mulai Padat';
      color = '#eab308';
    }

    return {
      avgSpeed: Math.round(avgSpeed * 10) / 10,
      avgAci: Math.round(avgAci * 100) / 100,
      label,
      color,
      segments: segments.length
    };
  },

  /**
   * Incident-aware ETA: if a verified incident lies near a segment,
   * reduce its effective speed for routing calculations.
   */
  getIncidentPenalty(lat, lon, radiusMeters = 400) {
    const active = db.all(
      "SELECT * FROM live_reports WHERE status IN ('verified', 'active') AND expires_at > ?",
      [Date.now()]
    );
    let penalty = 0;
    for (const r of active) {
      if (r.lat == null || r.lon == null) continue;
      const d = db.haversineDistanceMeters(lat, lon, r.lat, r.lon);
      if (d <= radiusMeters) penalty += r.category === 'traffic_jam' ? 0.35 : 0.2;
    }
    return Math.min(0.6, penalty);
  }
};

module.exports = TrafficService;
