const db = require('../../database/db');

/**
 * Daily & Weekly mission engine.
 * Goal types: distance (km) | report (count) | verify (count)
 */
const MissionService = {
  /**
   * Ensure a user has progress rows for all missions.
   */
  ensureRows(userId) {
    const missions = db.all('SELECT * FROM missions');
    for (const m of missions) {
      const existing = db.get(
        'SELECT * FROM user_mission_progress WHERE user_id = ? AND mission_id = ?',
        [userId, m.id]
      );
      if (!existing) {
        db.run(
          `INSERT INTO user_mission_progress (id, user_id, mission_id, current_count, is_completed, is_claimed)
           VALUES (?, ?, ?, 0, 0, 0)`,
          [`ump-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, userId, m.id]
        );
      }
    }
  },

  /**
   * Advance progress for every mission matching the goal type.
   */
  progress(userId, goalType, amount = 1) {
    this.ensureRows(userId);
    const missions = db.all('SELECT * FROM missions WHERE goal_type = ?', [goalType]);

    for (const m of missions) {
      const row = db.get(
        'SELECT * FROM user_mission_progress WHERE user_id = ? AND mission_id = ?',
        [userId, m.id]
      );
      if (!row || row.is_claimed) continue;

      const next = Math.min(m.target_count, row.current_count + amount);
      const completed = next >= m.target_count ? 1 : 0;
      db.run(
        `UPDATE user_mission_progress
         SET current_count = ?, is_completed = ?
         WHERE user_id = ? AND mission_id = ?`,
        [next, completed, userId, m.id]
      );
    }
  },

  /**
   * List missions with the user's progress.
   */
  getUserMissions(userId) {
    this.ensureRows(userId);
    const rows = db.all(
      `SELECT m.*, p.current_count, p.is_completed, p.is_claimed
       FROM missions m
       JOIN user_mission_progress p ON p.mission_id = m.id
       WHERE p.user_id = ?
       ORDER BY m.type DESC, m.id`,
      [userId]
    );

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      goalType: r.goal_type,
      targetCount: r.target_count,
      currentCount: Math.round(r.current_count * 10) / 10,
      progressPercent: Math.min(100, Math.round((r.current_count / r.target_count) * 100)),
      rewardXp: r.reward_xp,
      rewardCoins: r.reward_coins,
      isCompleted: !!r.is_completed,
      isClaimed: !!r.is_claimed
    }));
  },

  /**
   * Claim a completed mission reward (idempotent: only once).
   */
  claim(userId, missionId) {
    const row = db.get(
      'SELECT * FROM user_mission_progress WHERE user_id = ? AND mission_id = ?',
      [userId, missionId]
    );
    if (!row) throw new Error('Misi tidak ditemukan untuk pengguna ini');
    if (!row.is_completed) throw new Error('Misi belum selesai');
    if (row.is_claimed) throw new Error('Hadiah misi sudah diklaim');

    const mission = db.get('SELECT * FROM missions WHERE id = ?', [missionId]);
    if (!mission) throw new Error('Definisi misi tidak ditemukan');

    db.run(
      'UPDATE user_mission_progress SET is_claimed = 1 WHERE user_id = ? AND mission_id = ?',
      [userId, missionId]
    );
    db.run('UPDATE users SET nex_coins = nex_coins + ? WHERE id = ?', [mission.reward_coins, userId]);

    // Lazy require to avoid a circular dependency (gamification -> achievement -> ...)
    const GamificationService = require('./gamificationService');
    GamificationService.addXp(userId, mission.reward_xp, `mission_${missionId}`);

    return {
      success: true,
      missionId,
      rewardXp: mission.reward_xp,
      rewardCoins: mission.reward_coins
    };
  }
};

module.exports = MissionService;
