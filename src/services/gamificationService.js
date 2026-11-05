const db = require('../../database/db');

/**
 * Gamification, XP ledger, Missions, Achievements & Anti-Cheat Service
 */
const GamificationService = {
  /**
   * Required XP for a given level: 100 * (Level ^ 1.65)
   */
  getXpForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(100 * Math.pow(level, 1.65));
  },

  /**
   * Inverts XP to determine current Level
   */
  getLevelFromXp(xp) {
    if (xp <= 0) return 1;
    const rawLevel = Math.pow(xp / 100, 1 / 1.65);
    return Math.max(1, Math.floor(rawLevel));
  },

  /**
   * Get rank tier name by level
   */
  getRankTier(level) {
    if (level <= 5) return { rank: 'Beginner', badge: '🥉 Rookie', color: '#cd7f32' };
    if (level <= 10) return { rank: 'Explorer', badge: '🥈 Explorer', color: '#c0c0c0' };
    if (level <= 20) return { rank: 'Traveler', badge: '🥇 Traveler', color: '#ffd700' };
    if (level <= 30) return { rank: 'Adventurer', badge: '💎 Adventurer', color: '#00e5ff' };
    if (level <= 40) return { rank: 'Pathfinder', badge: '🔥 Pathfinder', color: '#ff6d00' };
    if (level <= 50) return { rank: 'Navigator', badge: '⭐ Navigator', color: '#a855f7' };
    if (level <= 75) return { rank: 'Master Explorer', badge: '🌟 Master Explorer', color: '#ec4899' };
    return { rank: 'Legendary', badge: '👑 Legendary', color: '#ef4444' };
  },

  /**
   * Anti-Cheat trip validator
   */
  validateTrip({ distanceKm, durationMins, maxSpeedKmh, mockFlag, accelMps2 }) {
    const flags = [];

    if (mockFlag === true) {
      flags.push('MOCK_LOCATION_ACTIVE');
    }

    if (maxSpeedKmh > 180) {
      flags.push('EXCESSIVE_SPEED_LIMIT_EXCEEDED');
    }

    if (accelMps2 != null && accelMps2 > 20) {
      flags.push('UNNATURAL_ACCELERATION_TELEPORT');
    }

    if (durationMins > 0) {
      const avgSpeed = distanceKm / (durationMins / 60);
      if (avgSpeed > 200) {
        flags.push('IMPLAUSIBLE_TRIP_AVERAGE_SPEED');
      }
    }

    if (distanceKm > 0 && distanceKm < 0.05) {
      flags.push('NEGLIGIBLE_DISTANCE');
    }

    const isValid = flags.length === 0;
    return { isValid, flags };
  },

  /**
   * Calculate XP awarded for a journey
   */
  calculateTripXp(distanceKm, isValid) {
    if (!isValid) return 0;
    const base = 10;
    const distanceBonus = Math.floor(distanceKm / 5) * 5;
    return base + distanceBonus;
  },

  /**
   * Add XP to user, append immutable XP ledger event, handle level-ups.
   * Note: callers that require mission progress should call Missions.progress separately
   * to avoid circular dependencies.
   */
  addXp(userId, xpToAdd, reason = 'activity') {
    const user = db.get('SELECT current_xp, level, nex_coins FROM users WHERE id = ?', [userId]);
    if (!user) return null;

    const newXp = user.current_xp + xpToAdd;
    const calculatedLevel = this.getLevelFromXp(newXp);
    const leveledUp = calculatedLevel > user.level;

    let bonusCoins = 0;
    if (leveledUp) {
      bonusCoins = (calculatedLevel - user.level) * 50;
    }

    db.run(
      `UPDATE users
       SET current_xp = ?, level = ?, nex_coins = nex_coins + ?
       WHERE id = ?`,
      [newXp, calculatedLevel, bonusCoins, userId]
    );

    // Immutable XP ledger (used by period-scoped leaderboards and audits)
    db.run(
      `INSERT INTO xp_events (id, user_id, amount, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [`xp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId, xpToAdd, reason, Date.now()]
    );

    // Achievements are evaluated on every XP change (cheap, deterministic)
    try {
      require('./achievementService').evaluate(userId);
    } catch (_) {
      /* achievement engine must never break core XP flow */
    }

    return {
      userId,
      addedXp: xpToAdd,
      currentXp: newXp,
      level: calculatedLevel,
      leveledUp,
      bonusCoins,
      reason
    };
  },

  /**
   * Record a completed trip and advance distance missions
   */
  recordTrip({ userId, vehicleType, distanceKm, durationMins, maxSpeedKmh, mockFlag, accelMps2 }) {
    const antiCheat = this.validateTrip({ distanceKm, durationMins, maxSpeedKmh, mockFlag, accelMps2 });
    const earnedXp = this.calculateTripXp(distanceKm, antiCheat.isValid);

    const tripId = `trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.run(
      `INSERT INTO trips (
        id, user_id, vehicle_type, distance_km, duration_mins,
        avg_speed_kmh, max_speed_kmh, earned_xp, is_valid, anti_cheat_flags, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId,
        userId,
        vehicleType,
        distanceKm,
        durationMins,
        durationMins > 0 ? (distanceKm / (durationMins / 60)) : 0,
        maxSpeedKmh,
        earnedXp,
        antiCheat.isValid ? 1 : 0,
        JSON.stringify(antiCheat.flags),
        Date.now()
      ]
    );

    if (antiCheat.isValid) {
      this.addXp(userId, earnedXp, 'completed_trip');
      db.run('UPDATE users SET total_km = total_km + ? WHERE id = ?', [distanceKm, userId]);
      require('./missionService').progress(userId, 'distance', distanceKm);
    }

    return {
      tripId,
      isValid: antiCheat.isValid,
      earnedXp,
      flags: antiCheat.flags
    };
  },

  /**
   * Multi-category, period-scoped leaderboards.
   * period: 'weekly' | 'monthly' | 'all'
   * scope:  'global' | 'friends'
   */
  getLeaderboards(category = 'explorer', { period = 'all', scope = 'global', viewerId = null, limit = 10 } = {}) {
    const now = Date.now();
    const since =
      period === 'weekly'
        ? now - 7 * 24 * 3600 * 1000
        : period === 'monthly'
        ? now - 30 * 24 * 3600 * 1000
        : 0;

    if (period === 'all') {
      return this._allTimeLeaderboard(category, scope, viewerId, limit);
    }

    let rows;
    if (category === 'explorer') {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                COALESCE(SUM(t.distance_km), 0) AS metric
         FROM users u
         LEFT JOIN trips t ON t.user_id = u.id AND t.is_valid = 1 AND t.created_at >= ?
         GROUP BY u.id ORDER BY metric DESC LIMIT ?`,
        [since, limit]
      );
    } else if (category === 'navigator') {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                COUNT(t.id) AS metric
         FROM users u
         LEFT JOIN trips t ON t.user_id = u.id AND t.is_valid = 1 AND t.created_at >= ?
         GROUP BY u.id ORDER BY metric DESC LIMIT ?`,
        [since, limit]
      );
    } else if (category === 'reporter') {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                COUNT(r.id) AS metric
         FROM users u
         LEFT JOIN live_reports r ON r.user_id = u.id AND r.created_at >= ?
         GROUP BY u.id ORDER BY metric DESC LIMIT ?`,
        [since, limit]
      );
    } else if (category === 'safety') {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                COUNT(v.id) AS metric
         FROM users u
         LEFT JOIN report_votes v ON v.user_id = u.id AND v.created_at >= ?
         GROUP BY u.id ORDER BY metric DESC LIMIT ?`,
        [since, limit]
      );
    } else if (category === 'city_explorer') {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                COUNT(DISTINCT r.road_name) AS metric
         FROM users u
         LEFT JOIN live_reports r ON r.user_id = u.id AND r.created_at >= ?
         GROUP BY u.id ORDER BY metric DESC LIMIT ?`,
        [since, limit]
      );
    } else {
      // contributor / XP period
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                COALESCE(SUM(x.amount), 0) AS metric
         FROM users u
         LEFT JOIN xp_events x ON x.user_id = u.id AND x.created_at >= ?
         GROUP BY u.id ORDER BY metric DESC LIMIT ?`,
        [since, limit]
      );
    }

    return this._decorate(rows, category, scope, viewerId);
  },

  _allTimeLeaderboard(category, scope, viewerId, limit) {
    const map = {
      explorer: ['total_km', 'DESC'],
      reporter: ['total_reports', 'DESC'],
      navigator: ['id', 'ASC'],
      safety: ['reputation_score', 'DESC'],
      city_explorer: ['id', 'ASC'],
      contributor: ['reputation_score', 'DESC'],
      overall: ['current_xp', 'DESC']
    };
    const [col, dir] = map[category] || map.overall;

    let rows;
    if (category === 'navigator') {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                COUNT(t.id) AS metric
         FROM users u LEFT JOIN trips t ON t.user_id = u.id AND t.is_valid = 1
         GROUP BY u.id ORDER BY metric DESC LIMIT ?`,
        [limit]
      );
    } else if (category === 'safety') {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                COUNT(v.id) AS metric
         FROM users u LEFT JOIN report_votes v ON v.user_id = u.id
         GROUP BY u.id ORDER BY metric DESC LIMIT ?`,
        [limit]
      );
    } else if (category === 'city_explorer') {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                COUNT(DISTINCT r.road_name) AS metric
         FROM users u LEFT JOIN live_reports r ON r.user_id = u.id
         GROUP BY u.id ORDER BY metric DESC LIMIT ?`,
        [limit]
      );
    } else if (category === 'contributor') {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                ROUND(u.reputation_score * 100, 1) AS metric
         FROM users u ORDER BY ${col} ${dir} LIMIT ?`,
        [limit]
      );
    } else {
      rows = db.all(
        `SELECT u.id, u.username, u.level, u.current_xp, u.active_title, u.active_skin,
                u.${col} AS metric
         FROM users u ORDER BY ${col} ${dir} LIMIT ?`,
        [limit]
      );
    }

    return this._decorate(rows, category, scope, viewerId);
  },

  _decorate(rows, category, scope, viewerId) {
    let list = rows;

    if (scope === 'friends' && viewerId) {
      const followed = db
        .all('SELECT following_id FROM follows WHERE follower_id = ?', [viewerId])
        .map(r => r.following_id);
      const allowed = new Set([...followed, viewerId]);
      list = rows.filter(r => allowed.has(r.id));
    }

    return list.map((r, index) => ({
      rank: index + 1,
      ...r,
      metric: Math.round((r.metric || 0) * 10) / 10,
      tier: this.getRankTier(r.level)
    }));
  }
};

module.exports = GamificationService;
