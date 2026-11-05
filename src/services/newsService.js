const db = require('../../database/db');

/**
 * Personalized traffic news feed: merges official government announcements,
 * community/corporate traffic news, and high-confidence verified reports.
 */
const NewsService = {
  getPersonalizedFeed({ lat = null, lon = null, limit = 20 } = {}) {
    const now = Date.now();

    const official = db.all(
      'SELECT * FROM civic_announcements WHERE expires_at > ? ORDER BY created_at DESC',
      [now]
    ).map(a => ({
      id: a.id,
      kind: 'official',
      source: a.source_agency,
      category: a.category,
      headline: a.headline,
      body: a.details,
      severity: a.severity,
      affectedArea: a.affected_area,
      lat: a.lat,
      lon: a.lon,
      radiusKm: a.radius_km,
      createdAt: a.created_at,
      verified: true
    }));

    const news = db.all(
      'SELECT * FROM traffic_news WHERE expires_at > ? ORDER BY created_at DESC',
      [now]
    ).map(n => ({
      id: n.id,
      kind: 'news',
      source: n.source || 'NEXMAP Newsroom',
      category: n.category,
      headline: n.headline,
      body: n.body,
      severity: n.severity,
      lat: n.lat,
      lon: n.lon,
      radiusKm: n.radius_km,
      createdAt: n.created_at,
      verified: true
    }));

    const reports = db.all(
      `SELECT * FROM live_reports
       WHERE status = 'verified' AND expires_at > ?
       ORDER BY confidence_score DESC, created_at DESC LIMIT 30`,
      [now]
    ).map(r => ({
      id: r.id,
      kind: 'community',
      source: `${r.author_name || 'Komunitas'} (Live Report)`,
      category: r.category,
      headline: r.title,
      body: r.description,
      severity: 'warning',
      lat: r.lat,
      lon: r.lon,
      radiusKm: 2,
      createdAt: r.created_at,
      verified: false
    }));

    let items = [...official, ...news, ...reports];

    if (lat != null && lon != null) {
      items = items.map(item => {
        let distanceKm = null;
        if (item.lat != null && item.lon != null) {
          distanceKm = db.haversineDistanceMeters(lat, lon, item.lat, item.lon) / 1000;
          distanceKm = Math.round(distanceKm * 10) / 10;
        }
        return {
          ...item,
          distanceKm,
          relevant: distanceKm != null ? distanceKm <= (item.radiusKm || 10) : false
        };
      });

      // Relevance first, then official severity, then recency
      const rank = { emergency: 3, warning: 2, info: 1 };
      items.sort((a, b) => {
        if (a.relevant !== b.relevant) return a.relevant ? -1 : 1;
        const ra = rank[a.severity] ?? 0;
        const rb = rank[b.severity] ?? 0;
        if (ra !== rb) return rb - ra;
        return b.createdAt - a.createdAt;
      });
    } else {
      const rank = { emergency: 3, warning: 2, info: 1 };
      items.sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0) || b.createdAt - a.createdAt);
    }

    return items.slice(0, limit);
  },

  publishNews({ headline, body, category = 'traffic', severity = 'info', source = 'NEXMAP Newsroom', lat = null, lon = null, radiusKm = 10, durationHours = 24 }) {
    if (!headline || !body) throw new Error('Judul dan isi berita wajib diisi');
    const id = `news-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    db.run(
      `INSERT INTO traffic_news (id, headline, body, category, severity, source, lat, lon, radius_km, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, headline, body, category, severity, source, lat, lon, radiusKm, now + durationHours * 3600 * 1000, now]
    );
    return { id, headline, severity, source };
  }
};

module.exports = NewsService;
