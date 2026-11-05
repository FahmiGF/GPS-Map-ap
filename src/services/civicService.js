const db = require('../../database/db');

const CivicService = {
  /**
   * Get active official civic announcements
   */
  getAnnouncements(userLat = null, userLon = null) {
    const now = Date.now();
    const rows = db.all(
      `SELECT * FROM civic_announcements
       WHERE expires_at > ?
       ORDER BY severity = 'emergency' DESC, created_at DESC`,
      [now]
    );

    if (userLat != null && userLon != null) {
      return rows.map(a => {
        let isWithinGeofence = false;
        let distanceKm = null;
        if (a.lat != null && a.lon != null) {
          const distMeters = db.haversineDistanceMeters(userLat, userLon, a.lat, a.lon);
          distanceKm = Number((distMeters / 1000).toFixed(1));
          isWithinGeofence = distanceKm <= (a.radius_km || 10);
        }
        return {
          ...a,
          distanceKm,
          isWithinGeofence
        };
      });
    }

    return rows;
  },

  /**
   * Publish a verified official civic announcement (Admin/Gov portal)
   */
  publishAnnouncement({ sourceAgency, category, headline, details, affectedArea, lat, lon, radiusKm = 10, severity = 'info', durationHours = 24 }) {
    const id = `civic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const expiresAt = now + (durationHours * 3600 * 1000);

    db.run(
      `INSERT INTO civic_announcements (
        id, source_agency, category, headline, details, affected_area,
        lat, lon, radius_km, severity, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sourceAgency, category, headline, details, affectedArea, lat, lon, radiusKm, severity, expiresAt, now]
    );

    return {
      id,
      sourceAgency,
      headline,
      severity,
      expiresAt
    };
  },

  /**
   * Calculate Automated Congestion Index (ACI)
   */
  calculateAci(actualSpeedKmh, freeFlowSpeedKmh = 60) {
    if (freeFlowSpeedKmh <= 0) return { aci: 1, label: 'Lancar', color: '#22c55e' };
    const aci = Number(Math.min(1.0, actualSpeedKmh / freeFlowSpeedKmh).toFixed(2));

    let label = 'Lancar';
    let color = '#22c55e'; // Green

    if (aci < 0.20) {
      label = 'Macet Total (Gridlock)';
      color = '#7f1d1d'; // Dark Red
    } else if (aci < 0.40) {
      label = 'Macet';
      color = '#ef4444'; // Red
    } else if (aci < 0.60) {
      label = 'Padat';
      color = '#f97316'; // Orange
    } else if (aci < 0.85) {
      label = 'Mulai Padat';
      color = '#eab308'; // Yellow
    }

    return { aci, label, color };
  }
};

module.exports = CivicService;
