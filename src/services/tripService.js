const db = require('../../database/db');

/**
 * Trip history and aggregate driving statistics.
 * Only anti-cheat-valid trips count toward rewards and statistics.
 */
const TripService = {
  history(userId, limit = 30) {
    const cappedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    return db
      .all(
        `SELECT id, vehicle_type, distance_km, duration_mins, avg_speed_kmh,
                max_speed_kmh, earned_xp, is_valid, anti_cheat_flags, created_at
         FROM trips WHERE user_id = ?
         ORDER BY created_at DESC LIMIT ?`,
        [userId, cappedLimit]
      )
      .map(t => ({
        ...t,
        is_valid: !!t.is_valid,
        anti_cheat_flags: safeParse(t.anti_cheat_flags)
      }));
  },

  stats(userId) {
    const totals = db.get(
      `SELECT
         COUNT(*) AS total_trips,
         COALESCE(SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END), 0) AS valid_trips,
         COALESCE(SUM(CASE WHEN is_valid = 0 THEN 1 ELSE 0 END), 0) AS rejected_trips,
         COALESCE(SUM(CASE WHEN is_valid = 1 THEN distance_km ELSE 0 END), 0) AS total_km,
         COALESCE(SUM(CASE WHEN is_valid = 1 THEN duration_mins ELSE 0 END), 0) AS total_minutes,
         COALESCE(SUM(CASE WHEN is_valid = 1 THEN earned_xp ELSE 0 END), 0) AS total_xp,
         COALESCE(MAX(CASE WHEN is_valid = 1 THEN distance_km END), 0) AS longest_km,
         COALESCE(MAX(CASE WHEN is_valid = 1 THEN max_speed_kmh END), 0) AS top_speed_kmh
       FROM trips WHERE user_id = ?`,
      [userId]
    );

    const avgSpeed =
      totals.total_minutes > 0
        ? Math.round((totals.total_km / (totals.total_minutes / 60)) * 10) / 10
        : 0;

    // Last 7 calendar days (oldest first) with distance + trip count
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const start = d.getTime();
      const end = start + 24 * 3600 * 1000;
      const row = db.get(
        `SELECT COUNT(*) AS trips,
                COALESCE(SUM(CASE WHEN is_valid = 1 THEN distance_km ELSE 0 END), 0) AS km
         FROM trips WHERE user_id = ? AND created_at >= ? AND created_at < ?`,
        [userId, start, end]
      );
      days.push({
        date: d.toISOString().slice(0, 10),
        trips: row.trips,
        km: Math.round(row.km * 10) / 10
      });
    }

    return {
      ...totals,
      avg_speed_kmh: avgSpeed,
      total_km: Math.round(totals.total_km * 10) / 10,
      longest_km: Math.round(totals.longest_km * 10) / 10,
      total_hours: Math.round((totals.total_minutes / 60) * 10) / 10,
      invalid_rate:
        totals.total_trips > 0
          ? Math.round((totals.rejected_trips / totals.total_trips) * 1000) / 10
          : 0,
      last_7_days: days
    };
  }
};

function safeParse(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

module.exports = TripService;
