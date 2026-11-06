const db = require('../../database/db');

const MAX_NOTIFICATIONS = 200;

let broadcaster = null;

/**
 * In-app notification center.
 * Notifications are persisted so they survive reconnects and can be audited.
 */
const NotificationService = {
  /**
   * Server wires this to the WebSocket broadcast function.
   */
  setBroadcaster(fn) {
    broadcaster = typeof fn === 'function' ? fn : null;
  },

  /**
   * Create a notification for a user.
   */
  notify({ userId, type = 'info', title, body = '', link = null }) {
    if (!userId || !title) return null;
    const id = `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    db.run(
      `INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, userId, type, title, body, link, Date.now()]
    );

    // Keep the table bounded per user (older notifications are pruned)
    const total = db.get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?', [userId]).c;
    if (total > MAX_NOTIFICATIONS) {
      db.run(
        `DELETE FROM notifications
         WHERE user_id = ? AND id IN (
           SELECT id FROM notifications WHERE user_id = ? ORDER BY created_at ASC LIMIT ?
         )`,
        [userId, userId, total - MAX_NOTIFICATIONS]
      );
    }

    const notification = db.get('SELECT * FROM notifications WHERE id = ?', [id]);
    if (broadcaster) {
      try { broadcaster(notification); } catch (_) { /* realtime must not break persistence */ }
    }
    return notification;
  },

  list(userId, { unreadOnly = false, limit = 50 } = {}) {
    const cappedLimit = Math.min(MAX_NOTIFICATIONS, Math.max(1, parseInt(limit, 10) || 50));
    const where = unreadOnly ? 'AND is_read = 0' : '';
    return db.all(
      `SELECT * FROM notifications
       WHERE user_id = ? ${where}
       ORDER BY created_at DESC LIMIT ?`,
      [userId, cappedLimit]
    );
  },

  unreadCount(userId) {
    return db.get(
      'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    ).c;
  },

  markRead(userId, notificationId) {
    const row = db.get('SELECT id FROM notifications WHERE id = ? AND user_id = ?', [
      notificationId,
      userId
    ]);
    if (!row) throw new Error('Notifikasi tidak ditemukan');
    db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [notificationId]);
    return { success: true, unreadCount: this.unreadCount(userId) };
  },

  markAllRead(userId) {
    db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
    return { success: true, unreadCount: 0 };
  },

  clear(userId) {
    db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
    return { success: true, unreadCount: 0 };
  }
};

module.exports = NotificationService;
