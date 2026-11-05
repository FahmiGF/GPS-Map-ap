const db = require('../../database/db');

/**
 * Achievement definitions are seeded into the `achievements` table.
 * Each achievement has a `metric` (computed below) and a numeric `threshold`.
 */
const ACHIEVEMENTS = [
  { id: 'ach-first-journey', name: 'First Journey', description: 'Menyelesaikan perjalanan valid pertama.', icon: '🚗', metric: 'trips_count', threshold: 1, reward_coins: 20 },
  { id: 'ach-road-explorer', name: 'Road Explorer', description: 'Melaporkan kondisi di 5 ruas jalan berbeda.', icon: '🧭', metric: 'distinct_roads', threshold: 5, reward_coins: 50 },
  { id: 'ach-community-hero', name: 'Community Hero', description: 'Mengirim 10 laporan komunitas.', icon: '🦸', metric: 'total_reports', threshold: 10, reward_coins: 100 },
  { id: 'ach-safety-guardian', name: 'Safety Guardian', description: 'Memverifikasi 10 laporan komunitas.', icon: '🛡️', metric: 'valid_confirmations', threshold: 10, reward_coins: 100 },
  { id: 'ach-long-distance', name: 'Long Distance', description: 'Menempuh total 1.000 km perjalanan valid.', icon: '🛣️', metric: 'total_km', threshold: 1000, reward_coins: 150 },
  { id: 'ach-city-traveler', name: 'City Traveler', description: 'Menjelajahi 10 ruas jalan berbeda.', icon: '🏙️', metric: 'distinct_roads', threshold: 10, reward_coins: 120 },
  { id: 'ach-early-explorer', name: 'Early Explorer', description: 'Melakukan 3 perjalanan pagi (05:00–07:00).', icon: '🌅', metric: 'early_trips', threshold: 3, reward_coins: 60 },
  { id: 'ach-level-10', name: 'Rising Navigator', description: 'Mencapai Level 10.', icon: '⭐', metric: 'level', threshold: 10, reward_coins: 80 },
  { id: 'ach-level-50', name: 'Elite Navigator', description: 'Mencapai Level 50.', icon: '🌟', metric: 'level', threshold: 50, reward_coins: 300 },
  { id: 'ach-legendary', name: 'Legendary Navigator', description: 'Mencapai Level 100.', icon: '👑', metric: 'level', threshold: 100, reward_coins: 1000 }
];

/**
 * Compute the current metric values for a user.
 */
function computeMetrics(userId) {
  const user = db.get('SELECT level, total_km, total_reports FROM users WHERE id = ?', [userId]);
  if (!user) return null;

  const trips = db.get(
    'SELECT COUNT(*) AS c FROM trips WHERE user_id = ? AND is_valid = 1',
    [userId]
  );
  const earlyTrips = db.all(
    'SELECT created_at FROM trips WHERE user_id = ? AND is_valid = 1',
    [userId]
  ).filter(t => {
    const hour = new Date(t.created_at).getHours();
    return hour >= 5 && hour < 7;
  }).length;
  const confirmations = db.get(
    "SELECT COUNT(*) AS c FROM report_votes WHERE user_id = ? AND vote_type = 'still_happening'",
    [userId]
  );
  const distinctRoads = db.get(
    'SELECT COUNT(DISTINCT road_name) AS c FROM live_reports WHERE user_id = ?',
    [userId]
  );

  return {
    level: user.level,
    total_km: user.total_km || 0,
    total_reports: user.total_reports || 0,
    trips_count: trips ? trips.c : 0,
    early_trips: earlyTrips,
    valid_confirmations: confirmations ? confirmations.c : 0,
    distinct_roads: distinctRoads ? distinctRoads.c : 0
  };
}

const AchievementService = {
  ACHIEVEMENTS,

  computeMetrics,

  /**
   * Evaluate all achievements and grant newly unlocked ones.
   * Returns the list of newly unlocked achievement definitions.
   */
  evaluate(userId) {
    const metrics = computeMetrics(userId);
    if (!metrics) return [];

    const unlocked = db.all('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [userId]).map(
      r => r.achievement_id
    );
    const unlockedSet = new Set(unlocked);
    const newlyUnlocked = [];

    for (const ach of this.getDefinitions()) {
      if (unlockedSet.has(ach.id)) continue;
      const value = metrics[ach.metric];
      if (value != null && value >= ach.threshold) {
        db.run(
          'INSERT INTO user_achievements (id, user_id, achievement_id, unlocked_at) VALUES (?, ?, ?, ?)',
          [`ua-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, userId, ach.id, Date.now()]
        );
        if (ach.reward_coins > 0) {
          db.run('UPDATE users SET nex_coins = nex_coins + ? WHERE id = ?', [ach.reward_coins, userId]);
        }
        newlyUnlocked.push(ach);
      }
    }

    return newlyUnlocked;
  },

  /**
   * Definitions come from the DB when seeded, otherwise from the constant fallback.
   */
  getDefinitions() {
    const rows = db.all('SELECT * FROM achievements');
    if (rows.length === 0) return ACHIEVEMENTS;
    return rows;
  },

  /**
   * Returns all achievements with unlock status/progress for a user.
   */
  getUserAchievements(userId) {
    const metrics = computeMetrics(userId) || {};
    const defs = this.getDefinitions();
    const unlocked = db.all('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?', [userId]);
    const unlockedMap = new Map(unlocked.map(u => [u.achievement_id, u.unlocked_at]));

    return defs.map(def => {
      const value = metrics[def.metric] ?? 0;
      return {
        ...def,
        progress: Math.min(100, Math.round((value / def.threshold) * 100)),
        currentValue: value,
        unlocked: unlockedMap.has(def.id),
        unlockedAt: unlockedMap.get(def.id) || null
      };
    });
  }
};

module.exports = AchievementService;
