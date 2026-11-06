const db = require('../../database/db');

/**
 * Threaded updates on a live report (text only).
 * Comments are moderated by status ('visible' | 'hidden').
 */
const CommentService = {
  list(reportId, limit = 50) {
    const cappedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    return db.all(
      `SELECT id, report_id, user_id, author_name, body, status, created_at
       FROM report_comments
       WHERE report_id = ? AND status = 'visible'
       ORDER BY created_at ASC LIMIT ?`,
      [reportId, cappedLimit]
    );
  },

  count(reportId) {
    return db.get(
      "SELECT COUNT(*) AS c FROM report_comments WHERE report_id = ? AND status = 'visible'",
      [reportId]
    ).c;
  },

  add({ reportId, userId, body }) {
    const report = db.get('SELECT id, user_id, title FROM live_reports WHERE id = ?', [reportId]);
    if (!report) throw new Error('Laporan tidak ditemukan');

    const text = String(body || '').trim();
    if (text.length < 3) throw new Error('Komentar minimal 3 karakter');
    if (text.length > 500) throw new Error('Komentar maksimal 500 karakter');

    // Basic anti-spam: identical comment by same user within 60 seconds
    const recent = db.get(
      `SELECT id FROM report_comments
       WHERE report_id = ? AND user_id = ? AND body = ? AND created_at > ?`,
      [reportId, userId, text, Date.now() - 60 * 1000]
    );
    if (recent) throw new Error('Komentar yang sama baru saja dikirim');

    const user = db.get('SELECT username FROM users WHERE id = ?', [userId]);
    const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    db.run(
      `INSERT INTO report_comments (id, report_id, user_id, author_name, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'visible', ?)`,
      [id, reportId, userId, user ? user.username : 'Komuter', text, Date.now()]
    );

    if (report.user_id !== userId) {
      require('./notificationService').notify({
        userId: report.user_id,
        type: 'comment',
        title: 'Komentar baru pada laporan Anda',
        body: `${user ? user.username : 'Pengguna'}: ${text.slice(0, 120)}`,
        link: `report:${reportId}`
      });
    }

    return db.get('SELECT * FROM report_comments WHERE id = ?', [id]);
  },

  remove(commentId, actorId, isAdmin = false) {
    const comment = db.get('SELECT * FROM report_comments WHERE id = ?', [commentId]);
    if (!comment) throw new Error('Komentar tidak ditemukan');
    if (!isAdmin && comment.user_id !== actorId) {
      throw new Error('Anda hanya dapat menghapus komentar sendiri');
    }
    db.run("UPDATE report_comments SET status = 'hidden' WHERE id = ?", [commentId]);
    return { success: true, commentId };
  }
};

module.exports = CommentService;
