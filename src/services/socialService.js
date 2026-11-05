const db = require('../../database/db');

/**
 * Social graph, public profiles, friends leaderboard scope.
 */
const SocialService = {
  follow(followerId, followingId) {
    if (followerId === followingId) throw new Error('Tidak dapat mengikuti diri sendiri');
    const target = db.get('SELECT id FROM users WHERE id = ?', [followingId]);
    if (!target) throw new Error('Pengguna tidak ditemukan');

    const existing = db.get(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [followerId, followingId]
    );
    if (existing) return { success: true, alreadyFollowing: true };

    db.run(
      'INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)',
      [`flw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, followerId, followingId, Date.now()]
    );
    return { success: true, alreadyFollowing: false };
  },

  unfollow(followerId, followingId) {
    db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
    return { success: true };
  },

  getProfile(userId, viewerId = null) {
    const user = db.get(
      `SELECT id, username, level, current_xp, reputation_score, active_vehicle,
              active_skin, active_title, privacy_mode, total_km, total_reports, created_at
       FROM users WHERE id = ?`,
      [userId]
    );
    if (!user) throw new Error('Pengguna tidak ditemukan');

    const followers = db.get('SELECT COUNT(*) AS c FROM follows WHERE following_id = ?', [userId]).c;
    const following = db.get('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?', [userId]).c;
    const isFollowing =
      viewerId != null
        ? !!db.get('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [viewerId, userId])
        : false;

    const GamificationService = require('./gamificationService');
    const AchievementService = require('./achievementService');

    return {
      ...user,
      tier: GamificationService.getRankTier(user.level),
      followers,
      following,
      isFollowing,
      achievements: AchievementService.getUserAchievements(userId).filter(a => a.unlocked),
      // Private profiles hide sensitive metrics from strangers (UU PDP privacy-by-default)
      total_km: user.privacy_mode === 'ghost' && viewerId !== userId ? null : user.total_km
    };
  },

  getFollowing(userId) {
    return db.all(
      `SELECT u.id, u.username, u.level, u.active_title
       FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ? ORDER BY u.username`,
      [userId]
    );
  },

  getFollowers(userId) {
    return db.all(
      `SELECT u.id, u.username, u.level, u.active_title
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ? ORDER BY u.username`,
      [userId]
    );
  },

  searchUsers(query, limit = 10) {
    const like = `%${query || ''}%`;
    return db.all(
      `SELECT id, username, level, active_title, total_km, total_reports
       FROM users WHERE username LIKE ? ORDER BY level DESC LIMIT ?`,
      [like, limit]
    );
  }
};

module.exports = SocialService;
